// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

/**
 * @title Board
 * @notice HOOD Board — 100 contestable Seats with self-assessed prices and holding costs.
 *
 * Seat lifecycle:
 *   VACANT → takeVacantSeat → ACTIVE
 *   ACTIVE  → setSeatPrice / topUpSeat (remains ACTIVE)
 *   ACTIVE  → takeSeat (new owner, remains ACTIVE)
 *   ACTIVE  → balance depletes → GRACE (derived, no keeper needed)
 *   GRACE   → topUpSeat → ACTIVE
 *   GRACE   → 72h expire → FORECLOSABLE (derived)
 *   FORECLOSABLE → forecloseSeat → VACANT
 *
 * Transfer restriction:
 *   Standard ERC-721 transferFrom / safeTransferFrom are disabled.
 *   Seat ownership changes only through BOARD lifecycle functions.
 *   This prevents bypassing takeover fees, price mechanics, and provenance.
 *
 * Fee math (integer arithmetic, no floats):
 *   rate_numerator   = 5   (0.5% = 5/1000)
 *   rate_denominator = 1000
 *   holding_period   = 604800 (seconds in 7 days)
 *   fee = (price * 5 * elapsed) / (1000 * 604800)
 *   Rounding: truncate (floor). Slight undercharge; owner bears no surprise.
 *
 * Depletion timestamp (deterministic, no storage):
 *   depletion = lastSettledAt + (prepaidBalance * 1000 * 604800) / (price * 5)
 *   Grace ends: depletion + 72 hours
 */
contract Board is ERC721, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ─── Constants ───────────────────────────────────────────────────────────

    uint256 public constant SEAT_COUNT = 100;

    /// @dev 0.5% per week expressed as numerator/denominator
    uint256 public constant HOLDING_RATE_NUMERATOR   = 5;
    uint256 public constant HOLDING_RATE_DENOMINATOR = 1000;

    /// @dev Seconds in 7 days
    uint256 public constant HOLDING_PERIOD = 604800;

    /// @dev 72-hour grace window in seconds
    uint256 public constant GRACE_PERIOD = 259200;

    /// @dev Seller receives 95% of takeover price; 5% to protocol
    uint256 public constant SELLER_SHARE_NUMERATOR   = 95;
    uint256 public constant PROTOCOL_FEE_NUMERATOR   = 5;
    uint256 public constant TAKEOVER_DENOMINATOR     = 100;

    /// @dev Buyer must pre-fund at least 2 weeks of holding at their chosen price
    uint256 public constant MIN_COVERAGE_WEEKS = 2;

    // ─── Immutables ───────────────────────────────────────────────────────────

    /// @notice ERC-20 token used for all payments (stable preferred)
    IERC20 public immutable settlementAsset;

    /// @notice Decimals of the settlement asset (cached to avoid repeat calls)
    uint256 public immutable assetDecimals;

    /// @notice Price (in settlement asset units) to take a vacant Seat
    uint256 public immutable vacantSeatPrice;

    /// @notice Protocol fee recipient
    address public immutable treasury;

    // ─── State ────────────────────────────────────────────────────────────────

    struct SeatData {
        uint256 price;           // Current self-assessed price in settlement units
        uint256 prepaidBalance;  // Balance remaining after last settlement
        uint256 lastSettledAt;   // Timestamp of last fee settlement
    }

    /// @dev seatId 1–100. VACANT when token does not exist (_ownerOf returns address(0)).
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

    // ─── Events ───────────────────────────────────────────────────────────────

    event SeatAcquired(
        uint256 indexed seatId,
        address indexed owner,
        uint256 initialPrice,
        uint256 initialHoldingDeposit,
        uint256 timestamp
    );

    event SeatPriceChanged(
        uint256 indexed seatId,
        address indexed owner,
        uint256 previousPrice,
        uint256 newPrice,
        uint256 timestamp
    );

    event SeatTaken(
        uint256 indexed seatId,
        address indexed previousOwner,
        address indexed newOwner,
        uint256 takeoverPrice,
        uint256 newPrice,
        uint256 remainingBalanceRefund,
        uint256 protocolFee,
        uint256 timestamp
    );

    event SeatToppedUp(
        uint256 indexed seatId,
        address indexed owner,
        uint256 amount,
        uint256 newPrepaidBalance,
        uint256 timestamp
    );

    event HoldingFeesSettled(
        uint256 indexed seatId,
        uint256 fee,
        uint256 elapsed,
        uint256 remainingBalance,
        uint256 timestamp
    );

    event SeatForeclosed(
        uint256 indexed seatId,
        address indexed previousOwner,
        uint256 timestamp
    );

    // ─── Constructor ──────────────────────────────────────────────────────────

    /**
     * @param _settlementAsset ERC-20 token address for all payments
     * @param _vacantSeatPrice Cost to take a vacant Seat (in settlement asset units)
     * @param _treasury        Recipient of protocol fees
     * @param _admin           Contract owner (for future param adjustments if any)
     */
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

    // ─── Transfer Restriction ─────────────────────────────────────────────────

    /// @dev Block all standard ERC-721 ownership transfers. Ownership moves only
    ///      through takeVacantSeat, takeSeat, and forecloseSeat.
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

    /**
     * @dev Accrue holding fee for elapsed time. Truncates (floor).
     *      fee = (price * HOLDING_RATE_NUMERATOR * elapsed) / (HOLDING_RATE_DENOMINATOR * HOLDING_PERIOD)
     */
    function _accruedFee(uint256 price, uint256 elapsed) internal pure returns (uint256) {
        return (price * HOLDING_RATE_NUMERATOR * elapsed) / (HOLDING_RATE_DENOMINATOR * HOLDING_PERIOD);
    }

    /**
     * @dev Settle accrued holding fees against a seat's prepaid balance.
     *      Clamps deduction to available balance (balance cannot go negative).
     *      Emits HoldingFeesSettled if time has elapsed.
     */
    function _settle(uint256 seatId) internal {
        SeatData storage seat = _seatData[seatId];
        uint256 elapsed = block.timestamp - seat.lastSettledAt;
        if (elapsed == 0) return;

        uint256 fee = _accruedFee(seat.price, elapsed);
        // Clamp: balance cannot go below zero
        if (fee > seat.prepaidBalance) {
            fee = seat.prepaidBalance;
        }

        seat.prepaidBalance -= fee;
        seat.lastSettledAt   = block.timestamp;

        emit HoldingFeesSettled(seatId, fee, elapsed, seat.prepaidBalance, block.timestamp);
    }

    /**
     * @dev Minimum prepaid deposit required for `weeks_` weeks at `price`.
     */
    function _minDeposit(uint256 price, uint256 weeks_) internal pure returns (uint256) {
        // weekly cost = price * HOLDING_RATE_NUMERATOR / HOLDING_RATE_DENOMINATOR
        // min deposit  = weekly cost * weeks_
        return (price * HOLDING_RATE_NUMERATOR * weeks_) / HOLDING_RATE_DENOMINATOR;
    }

    /**
     * @dev Deterministic depletion timestamp. Does NOT write state.
     *      depletion = lastSettledAt + (prepaidBalance * HOLDING_RATE_DENOMINATOR * HOLDING_PERIOD)
     *                                  / (price * HOLDING_RATE_NUMERATOR)
     *      Returns type(uint256).max if price is zero (vacant seat guard).
     */
    function _depletionTimestamp(uint256 price, uint256 prepaidBalance, uint256 lastSettledAt)
        internal
        pure
        returns (uint256)
    {
        if (price == 0) return type(uint256).max;
        return lastSettledAt
            + (prepaidBalance * HOLDING_RATE_DENOMINATOR * HOLDING_PERIOD)
              / (price * HOLDING_RATE_NUMERATOR);
    }

    // ─── Seat State Queries ───────────────────────────────────────────────────

    enum SeatStatus { VACANT, ACTIVE, GRACE, FORECLOSABLE }

    /**
     * @notice Current derived status of a Seat.
     * @dev Does NOT settle — reads current stored state and derives.
     *      For display/read purposes. Lifecycle functions settle before acting.
     */
    function seatStatus(uint256 seatId) public view returns (SeatStatus) {
        _requireValidSeatId(seatId);
        if (!_isOccupied(seatId)) return SeatStatus.VACANT;

        SeatData storage seat = _seatData[seatId];
        uint256 elapsed = block.timestamp - seat.lastSettledAt;
        uint256 accruedSoFar = _accruedFee(seat.price, elapsed);

        if (accruedSoFar < seat.prepaidBalance) {
            return SeatStatus.ACTIVE;
        }

        // Balance exhausted — compute depletion time
        uint256 depletion = _depletionTimestamp(seat.price, seat.prepaidBalance, seat.lastSettledAt);
        uint256 graceEnd  = depletion + GRACE_PERIOD;

        if (block.timestamp <= graceEnd) return SeatStatus.GRACE;
        return SeatStatus.FORECLOSABLE;
    }

    /**
     * @notice Full coverage view for a Seat.
     */
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
        effectiveBalance = accrued >= seat.prepaidBalance ? 0 : seat.prepaidBalance - accrued;

        weeklyHoldingCost = (seat.price * HOLDING_RATE_NUMERATOR) / HOLDING_RATE_DENOMINATOR;

        depletionTimestamp = _depletionTimestamp(seat.price, seat.prepaidBalance, seat.lastSettledAt);
        graceEndsAt = depletionTimestamp == type(uint256).max
            ? type(uint256).max
            : depletionTimestamp + GRACE_PERIOD;

        status = seatStatus(seatId);
    }

    // ─── Lifecycle Functions ──────────────────────────────────────────────────

    /**
     * @notice Take a vacant Seat. Caller becomes owner.
     * @param seatId       Seat number (1–100)
     * @param chosenPrice  Self-assessed price (must be > 0)
     * @param prepaidAmount Settlement asset amount to deposit. Must be ≥ 2 weeks coverage.
     *
     * Caller must have pre-approved this contract for:
     *   vacantSeatPrice + prepaidAmount
     */
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

        // Collect vacant Seat price and prepaid balance
        settlementAsset.safeTransferFrom(msg.sender, treasury, vacantSeatPrice);
        settlementAsset.safeTransferFrom(msg.sender, address(this), prepaidAmount);

        // Assign ownership (internal ERC-721 mint)
        _mint(msg.sender, seatId);

        _seatData[seatId] = SeatData({
            price:          chosenPrice,
            prepaidBalance: prepaidAmount,
            lastSettledAt:  block.timestamp
        });

        emit SeatAcquired(seatId, msg.sender, chosenPrice, prepaidAmount, block.timestamp);
    }

    /**
     * @notice Change the self-assessed price of your Seat.
     *         Settles accrued fees at the OLD price before updating.
     */
    function setSeatPrice(uint256 seatId, uint256 newPrice) external nonReentrant {
        _requireValidSeatId(seatId);
        if (!_isOccupied(seatId)) revert SeatNotOccupied(seatId);
        if (_ownerOf(seatId) != msg.sender) revert NotSeatOwner(seatId, msg.sender);
        if (newPrice == 0) revert ZeroPrice();

        _settle(seatId);

        uint256 oldPrice = _seatData[seatId].price;
        _seatData[seatId].price = newPrice;

        emit SeatPriceChanged(seatId, msg.sender, oldPrice, newPrice, block.timestamp);
    }

    /**
     * @notice Add funds to your Seat's prepaid holding balance.
     *         If the Seat is in GRACE, this restores it to ACTIVE.
     */
    function topUpSeat(uint256 seatId, uint256 amount) external nonReentrant {
        _requireValidSeatId(seatId);
        if (!_isOccupied(seatId)) revert SeatNotOccupied(seatId);
        if (_ownerOf(seatId) != msg.sender) revert NotSeatOwner(seatId, msg.sender);

        // Settle first so prepaidBalance is up to date
        _settle(seatId);

        settlementAsset.safeTransferFrom(msg.sender, address(this), amount);
        _seatData[seatId].prepaidBalance += amount;

        emit SeatToppedUp(
            seatId,
            msg.sender,
            amount,
            _seatData[seatId].prepaidBalance,
            block.timestamp
        );
    }

    /**
     * @notice Take an occupied Seat from its current owner by paying the Seat price.
     *
     * @param seatId           Target Seat
     * @param expectedOwner    Guard: revert if owner changed (stale-takeover protection)
     * @param expectedPrice    Guard: revert if price changed (stale-price protection)
     * @param newPrice         Buyer's self-assessed price post-takeover
     * @param prepaidDeposit   Buyer's prepaid holding balance. Must be ≥ 2 weeks at newPrice.
     *
     * Economics on execution:
     *   - Buyer pays: expectedPrice (takeover) + prepaidDeposit
     *   - Seller gets: 95% of expectedPrice + remaining prepaid balance (after fee settlement)
     *   - Protocol gets: 5% of expectedPrice
     *   - Buyer's seat is activated at newPrice with prepaidDeposit balance
     */
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

        // Settle accrued fees so remaining balance is accurate
        _settle(seatId);

        uint256 minRequired = _minDeposit(newPrice, MIN_COVERAGE_WEEKS);
        if (prepaidDeposit < minRequired) revert InsufficientDeposit(minRequired, prepaidDeposit);

        uint256 takeoverPrice    = seat.price; // already verified == expectedPrice before settle
        uint256 remainingBalance = seat.prepaidBalance;

        uint256 sellerProceeds = (takeoverPrice * SELLER_SHARE_NUMERATOR) / TAKEOVER_DENOMINATOR;
        uint256 protocolFee    = takeoverPrice - sellerProceeds; // exact: avoids rounding gap

        // Collect takeover price + buyer prepaid from buyer
        settlementAsset.safeTransferFrom(msg.sender, address(this), takeoverPrice + prepaidDeposit);

        // Pay seller: takeover proceeds + their remaining prepaid balance
        uint256 sellerTotal = sellerProceeds + remainingBalance;
        settlementAsset.safeTransfer(currentOwner, sellerTotal);

        // Pay protocol
        settlementAsset.safeTransfer(treasury, protocolFee);

        // Transfer Seat ownership (internal, bypasses disabled public functions)
        _transfer(currentOwner, msg.sender, seatId);

        // Reset seat state for new owner
        _seatData[seatId] = SeatData({
            price:          newPrice,
            prepaidBalance: prepaidDeposit,
            lastSettledAt:  block.timestamp
        });

        emit SeatTaken(
            seatId,
            currentOwner,
            msg.sender,
            takeoverPrice,
            newPrice,
            remainingBalance,
            protocolFee,
            block.timestamp
        );
    }

    /**
     * @notice Foreclose a Seat whose grace period has expired.
     *         Anyone may call this. Seat returns to VACANT.
     *         Seat identity (seatId) is permanently preserved.
     */
    function forecloseSeat(uint256 seatId) external nonReentrant {
        _requireValidSeatId(seatId);
        if (!_isOccupied(seatId)) revert SeatNotOccupied(seatId);

        SeatData storage seat = _seatData[seatId];

        uint256 depletion = _depletionTimestamp(seat.price, seat.prepaidBalance, seat.lastSettledAt);
        uint256 graceEnd  = depletion + GRACE_PERIOD;

        if (block.timestamp <= graceEnd) revert GraceNotExpired(seatId, graceEnd);

        address previousOwner = _ownerOf(seatId);

        // Burn the token — returns Seat to VACANT state
        // Any remaining balance was exhausted (prepaid was 0 when depletion was computed)
        _burn(seatId);
        delete _seatData[seatId];

        emit SeatForeclosed(seatId, previousOwner, block.timestamp);
    }

    // ─── Owner Admin ──────────────────────────────────────────────────────────

    /**
     * @notice Emergency rescue for tokens accidentally sent to this contract.
     *         Cannot withdraw the settlement asset used for Seat balances.
     */
    function rescueToken(address token, uint256 amount, address to) external onlyOwner {
        require(token != address(settlementAsset), "Cannot rescue settlement asset");
        IERC20(token).safeTransfer(to, amount);
    }
}
