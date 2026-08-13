// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IRewardAccounting} from "./IRewardAccounting.sol";

/// @title Board_v2
/// @notice HOOD Board — 100 contestable Seats with time-weighted reward accounting.
///
/// Extends Board.sol with productive Seat economics:
///   ACTIVE Seats accrue from the Board's underlying strategy revenue.
///   GRACE pauses accrual; the gap is not retroactively filled on resume.
///   Ownership transfers atomically bank the old owner's earnings and start the new owner.
///
/// Backward compatibility:
///   If rewardAccounting == address(0), all reward hooks are no-ops.
///   The base Seat engine (price/hold/takeover/grace/foreclosure) is identical to Board.sol.
///
/// Reward hook points:
///   takeVacantSeat    → onSeatActivated      (VACANT → ACTIVE)
///   topUpSeat         → onGraceEntered if was ACTIVE that depleted, then onSeatResumed
///   setSeatPrice      → onGraceEntered if balance just depleted
///   takeSeat          → onOwnershipTransfer (ACTIVE) or onSeatActivated (from GRACE)
///   forecloseSeat     → onGraceEntered (if not yet synced) then onSeatForeclosed
contract Board_v2 is ERC721, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ─── Constants ───────────────────────────────────────────────────────────

    uint256 public constant SEAT_COUNT = 100;
    uint256 public constant HOLDING_RATE_NUMERATOR   = 5;
    uint256 public constant HOLDING_RATE_DENOMINATOR = 1000;
    uint256 public constant HOLDING_PERIOD = 604800;    // 7 days
    uint256 public constant GRACE_PERIOD   = 259200;    // 72 hours
    uint256 public constant SELLER_SHARE_NUMERATOR = 95;
    uint256 public constant PROTOCOL_FEE_NUMERATOR = 5;
    uint256 public constant TAKEOVER_DENOMINATOR   = 100;
    uint256 public constant MIN_COVERAGE_WEEKS = 2;

    // ─── Immutables ───────────────────────────────────────────────────────────

    IERC20 public immutable settlementAsset;
    uint256 public immutable assetDecimals;
    uint256 public immutable vacantSeatPrice;
    address public immutable treasury;

    // ─── Reward Accounting ────────────────────────────────────────────────────

    /// @notice Optional reward accounting contract. address(0) = no-op (base engine only).
    IRewardAccounting public rewardAccounting;
    bool private _raSet;

    // ─── State ────────────────────────────────────────────────────────────────

    struct SeatData {
        uint256 price;
        uint256 prepaidBalance;
        uint256 lastSettledAt;
    }

    mapping(uint256 => SeatData) private _seatData;

    // ─── Errors ───────────────────────────────────────────────────────────────

    error InvalidSeatId(uint256 seatId);
    error SeatNotVacant(uint256 seatId);
    error SeatNotOccupied(uint256 seatId);
    error NotSeatOwner(uint256 seatId, address caller);
    error SelfTakeover(uint256 seatId);
    error StaleOwner(uint256 seatId, address expected, address actual);
    error StalePrice(uint256 seatId, uint256 expected, uint256 actual);
    error ZeroPrice();
    error InsufficientDeposit(uint256 required, uint256 provided);
    error GraceNotExpired(uint256 seatId, uint256 graceEndsAt);
    error TransfersDisabled();
    error RewardAccountingAlreadySet();

    // ─── Events ───────────────────────────────────────────────────────────────

    event SeatAcquired(uint256 indexed seatId, address indexed owner, uint256 initialPrice, uint256 initialHoldingDeposit, uint256 timestamp);
    event SeatPriceChanged(uint256 indexed seatId, address indexed owner, uint256 previousPrice, uint256 newPrice, uint256 timestamp);
    event SeatTaken(uint256 indexed seatId, address indexed previousOwner, address indexed newOwner, uint256 takeoverPrice, uint256 newPrice, uint256 remainingBalanceRefund, uint256 protocolFee, uint256 timestamp);
    event SeatToppedUp(uint256 indexed seatId, address indexed owner, uint256 amount, uint256 newPrepaidBalance, uint256 timestamp);
    event HoldingFeesSettled(uint256 indexed seatId, uint256 fee, uint256 elapsed, uint256 remainingBalance, uint256 timestamp);
    event SeatForeclosed(uint256 indexed seatId, address indexed previousOwner, uint256 timestamp);
    event RewardAccountingSet(address indexed rewardAccounting);

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(
        address _settlementAsset,
        uint256 _vacantSeatPrice,
        address _treasury,
        address _admin
    ) ERC721("HOOD Board Seat", "SEAT") Ownable(_admin) {
        require(_settlementAsset != address(0), "Zero asset");
        require(_treasury != address(0), "Zero treasury");
        require(_vacantSeatPrice > 0, "Zero vacant price");

        settlementAsset = IERC20(_settlementAsset);
        assetDecimals   = IERC20Metadata(_settlementAsset).decimals();
        vacantSeatPrice = _vacantSeatPrice;
        treasury        = _treasury;
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    /// @notice Wire up reward accounting after both contracts are deployed. One-time set.
    function setRewardAccounting(address ra) external onlyOwner {
        if (_raSet) revert RewardAccountingAlreadySet();
        rewardAccounting = IRewardAccounting(ra);
        _raSet = true;
        emit RewardAccountingSet(ra);
    }

    // ─── Transfer Restriction ─────────────────────────────────────────────────

    function transferFrom(address, address, uint256) public pure override {
        revert TransfersDisabled();
    }

    function safeTransferFrom(address, address, uint256, bytes memory) public pure override {
        revert TransfersDisabled();
    }

    // ─── Internal Helpers ─────────────────────────────────────────────────────

    function _requireValidSeatId(uint256 seatId) internal pure {
        if (seatId == 0 || seatId > SEAT_COUNT) revert InvalidSeatId(seatId);
    }

    function _isOccupied(uint256 seatId) internal view returns (bool) {
        return _ownerOf(seatId) != address(0);
    }

    function _accruedFee(uint256 price, uint256 elapsed) internal pure returns (uint256) {
        return (price * HOLDING_RATE_NUMERATOR * elapsed) / (HOLDING_RATE_DENOMINATOR * HOLDING_PERIOD);
    }

    /// @dev Settle accrued holding fees. Returns post-settle prepaid balance.
    function _settle(uint256 seatId) internal returns (uint256 remaining) {
        SeatData storage seat = _seatData[seatId];
        uint256 elapsed = block.timestamp - seat.lastSettledAt;
        if (elapsed == 0) return seat.prepaidBalance;

        uint256 fee = _accruedFee(seat.price, elapsed);
        if (fee > seat.prepaidBalance) fee = seat.prepaidBalance;

        seat.prepaidBalance -= fee;
        seat.lastSettledAt   = block.timestamp;

        emit HoldingFeesSettled(seatId, fee, elapsed, seat.prepaidBalance, block.timestamp);
        return seat.prepaidBalance;
    }

    function _minDeposit(uint256 price, uint256 weeks_) internal pure returns (uint256) {
        return (price * HOLDING_RATE_NUMERATOR * weeks_) / HOLDING_RATE_DENOMINATOR;
    }

    function _depletionTimestamp(uint256 price, uint256 prepaidBalance, uint256 lastSettledAt)
        internal pure returns (uint256)
    {
        if (price == 0) return type(uint256).max;
        return lastSettledAt
            + (prepaidBalance * HOLDING_RATE_DENOMINATOR * HOLDING_PERIOD)
              / (price * HOLDING_RATE_NUMERATOR);
    }

    /// @dev Sync reward accounting state when balance may have depleted.
    ///      If ra believes the seat is accruing but it is in GRACE/FORECLOSABLE, notify grace.
    ///      Must be called AFTER _settle so that seatStatus() reflects settled balance.
    function _syncGraceHook(uint256 seatId, address owner) internal {
        IRewardAccounting ra = rewardAccounting;
        if (address(ra) == address(0)) return;
        if (!ra.accruing(seatId)) return; // already not accruing in reward system
        SeatStatus s = seatStatus(seatId);
        if (s == SeatStatus.GRACE || s == SeatStatus.FORECLOSABLE) {
            ra.onGraceEntered(seatId, owner);
        }
    }

    // ─── Seat State Queries ───────────────────────────────────────────────────

    enum SeatStatus { VACANT, ACTIVE, GRACE, FORECLOSABLE }

    function seatStatus(uint256 seatId) public view returns (SeatStatus) {
        _requireValidSeatId(seatId);
        if (!_isOccupied(seatId)) return SeatStatus.VACANT;

        SeatData storage seat = _seatData[seatId];
        uint256 elapsed      = block.timestamp - seat.lastSettledAt;
        uint256 accruedSoFar = _accruedFee(seat.price, elapsed);

        if (accruedSoFar < seat.prepaidBalance) return SeatStatus.ACTIVE;

        uint256 depletion = _depletionTimestamp(seat.price, seat.prepaidBalance, seat.lastSettledAt);
        uint256 graceEnd  = depletion + GRACE_PERIOD;

        if (block.timestamp <= graceEnd) return SeatStatus.GRACE;
        return SeatStatus.FORECLOSABLE;
    }

    function seatCoverage(uint256 seatId) external view returns (
        address owner,
        uint256 price,
        uint256 storedPrepaidBalance,
        uint256 effectiveBalance,
        uint256 weeklyHoldingCost,
        uint256 depletionTimestamp,
        uint256 graceEndsAt,
        SeatStatus status
    ) {
        _requireValidSeatId(seatId);
        owner = _ownerOf(seatId);
        SeatData storage seat = _seatData[seatId];
        price = seat.price;

        uint256 elapsed = block.timestamp - seat.lastSettledAt;
        uint256 accrued = _accruedFee(seat.price, elapsed);
        storedPrepaidBalance = seat.prepaidBalance;
        effectiveBalance     = accrued >= seat.prepaidBalance ? 0 : seat.prepaidBalance - accrued;
        weeklyHoldingCost    = (seat.price * HOLDING_RATE_NUMERATOR) / HOLDING_RATE_DENOMINATOR;
        depletionTimestamp   = _depletionTimestamp(seat.price, seat.prepaidBalance, seat.lastSettledAt);
        graceEndsAt          = depletionTimestamp == type(uint256).max
            ? type(uint256).max
            : depletionTimestamp + GRACE_PERIOD;
        status = seatStatus(seatId);
    }

    // ─── Lifecycle Functions ──────────────────────────────────────────────────

    /// @notice Take a vacant Seat. Caller becomes owner and begins accruing rewards.
    function takeVacantSeat(
        uint256 seatId,
        uint256 chosenPrice,
        uint256 prepaidAmount
    ) external nonReentrant {
        _requireValidSeatId(seatId);
        if (_isOccupied(seatId)) revert SeatNotVacant(seatId);
        if (chosenPrice == 0) revert ZeroPrice();

        uint256 minRequired = _minDeposit(chosenPrice, MIN_COVERAGE_WEEKS);
        if (prepaidAmount < minRequired) revert InsufficientDeposit(minRequired, prepaidAmount);

        settlementAsset.safeTransferFrom(msg.sender, treasury, vacantSeatPrice);
        settlementAsset.safeTransferFrom(msg.sender, address(this), prepaidAmount);

        _mint(msg.sender, seatId);

        _seatData[seatId] = SeatData({
            price:          chosenPrice,
            prepaidBalance: prepaidAmount,
            lastSettledAt:  block.timestamp
        });

        emit SeatAcquired(seatId, msg.sender, chosenPrice, prepaidAmount, block.timestamp);

        // Reward hook: seat is now ACTIVE
        IRewardAccounting ra = rewardAccounting;
        if (address(ra) != address(0)) {
            ra.onSeatActivated(seatId, msg.sender);
        }
    }

    /// @notice Change the self-assessed Ask price. Settles fees at old price first.
    function setSeatPrice(uint256 seatId, uint256 newPrice) external nonReentrant {
        _requireValidSeatId(seatId);
        if (!_isOccupied(seatId)) revert SeatNotOccupied(seatId);
        if (_ownerOf(seatId) != msg.sender) revert NotSeatOwner(seatId, msg.sender);
        if (newPrice == 0) revert ZeroPrice();

        _settle(seatId);
        // Detect ACTIVE→GRACE transition if settle drained the balance
        _syncGraceHook(seatId, msg.sender);

        uint256 oldPrice = _seatData[seatId].price;
        _seatData[seatId].price = newPrice;

        emit SeatPriceChanged(seatId, msg.sender, oldPrice, newPrice, block.timestamp);
    }

    /// @notice Top up the prepaid holding balance. Restores GRACE seats to ACTIVE.
    function topUpSeat(uint256 seatId, uint256 amount) external nonReentrant {
        _requireValidSeatId(seatId);
        if (!_isOccupied(seatId)) revert SeatNotOccupied(seatId);
        if (_ownerOf(seatId) != msg.sender) revert NotSeatOwner(seatId, msg.sender);

        _settle(seatId);

        // Detect ACTIVE→GRACE if settle just drained the balance
        _syncGraceHook(seatId, msg.sender);

        // Record whether accrual is paused before the top-up
        IRewardAccounting ra = rewardAccounting;
        bool wasNotAccruing = (address(ra) != address(0)) && !ra.accruing(seatId);

        settlementAsset.safeTransferFrom(msg.sender, address(this), amount);
        _seatData[seatId].prepaidBalance += amount;

        emit SeatToppedUp(seatId, msg.sender, amount, _seatData[seatId].prepaidBalance, block.timestamp);

        // Reward hook: if was in grace (not accruing), resume now that balance is positive
        if (wasNotAccruing) {
            ra.onSeatResumed(seatId, msg.sender);
        }
    }

    /// @notice Take an occupied Seat from its current owner by paying the Ask price.
    function takeSeat(
        uint256 seatId,
        address expectedOwner,
        uint256 expectedPrice,
        uint256 newPrice,
        uint256 prepaidDeposit
    ) external nonReentrant {
        _requireValidSeatId(seatId);
        if (!_isOccupied(seatId)) revert SeatNotOccupied(seatId);
        if (newPrice == 0) revert ZeroPrice();

        address currentOwner = _ownerOf(seatId);
        if (currentOwner == msg.sender) revert SelfTakeover(seatId);
        if (currentOwner != expectedOwner) revert StaleOwner(seatId, expectedOwner, currentOwner);

        SeatData storage seat = _seatData[seatId];
        if (seat.price != expectedPrice) revert StalePrice(seatId, expectedPrice, seat.price);

        _settle(seatId);

        // Detect ACTIVE→GRACE transition before ownership changes
        _syncGraceHook(seatId, currentOwner);

        // Snapshot whether old owner was accruing (after grace sync)
        IRewardAccounting ra = rewardAccounting;
        bool oldOwnerWasAccruing = (address(ra) != address(0)) && ra.accruing(seatId);

        uint256 minRequired = _minDeposit(newPrice, MIN_COVERAGE_WEEKS);
        if (prepaidDeposit < minRequired) revert InsufficientDeposit(minRequired, prepaidDeposit);

        uint256 takeoverPrice    = seat.price;
        uint256 remainingBalance = seat.prepaidBalance;

        uint256 sellerProceeds = (takeoverPrice * SELLER_SHARE_NUMERATOR) / TAKEOVER_DENOMINATOR;
        uint256 protocolFee    = takeoverPrice - sellerProceeds;

        settlementAsset.safeTransferFrom(msg.sender, address(this), takeoverPrice + prepaidDeposit);
        settlementAsset.safeTransfer(currentOwner, sellerProceeds + remainingBalance);
        settlementAsset.safeTransfer(treasury, protocolFee);

        _transfer(currentOwner, msg.sender, seatId);

        _seatData[seatId] = SeatData({
            price:          newPrice,
            prepaidBalance: prepaidDeposit,
            lastSettledAt:  block.timestamp
        });

        emit SeatTaken(seatId, currentOwner, msg.sender, takeoverPrice, newPrice, remainingBalance, protocolFee, block.timestamp);

        // Reward hooks: atomic ownership transition
        if (address(ra) != address(0)) {
            if (oldOwnerWasAccruing) {
                // Was ACTIVE: bank old owner, start new owner
                ra.onOwnershipTransfer(seatId, currentOwner, msg.sender);
            } else {
                // Was GRACE: old owner already banked at grace entry; just start new owner
                ra.onSeatActivated(seatId, msg.sender);
            }
        }
    }

    /// @notice Foreclose a Seat whose grace period has expired. Anyone may call.
    function forecloseSeat(uint256 seatId) external nonReentrant {
        _requireValidSeatId(seatId);
        if (!_isOccupied(seatId)) revert SeatNotOccupied(seatId);

        SeatData storage seat = _seatData[seatId];

        uint256 depletion = _depletionTimestamp(seat.price, seat.prepaidBalance, seat.lastSettledAt);
        uint256 graceEnd  = depletion + GRACE_PERIOD;

        if (block.timestamp <= graceEnd) revert GraceNotExpired(seatId, graceEnd);

        address previousOwner = _ownerOf(seatId);

        // Sync grace state in reward accounting before foreclosure
        // (handles case where no function was called after balance depletion)
        _syncGraceHook(seatId, previousOwner);

        IRewardAccounting ra = rewardAccounting;
        if (address(ra) != address(0)) {
            ra.onSeatForeclosed(seatId, previousOwner);
        }

        _burn(seatId);
        delete _seatData[seatId];

        emit SeatForeclosed(seatId, previousOwner, block.timestamp);
    }

    // ─── Owner Admin ──────────────────────────────────────────────────────────

    function rescueToken(address token, uint256 amount, address to) external onlyOwner {
        require(token != address(settlementAsset), "Cannot rescue settlement asset");
        IERC20(token).safeTransfer(to, amount);
    }
}
