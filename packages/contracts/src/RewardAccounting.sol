// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IRewardAccounting} from "./IRewardAccounting.sol";

/// @notice Time-weighted reward accounting for BOARD seats.
///
/// Architecture:
///   globalIndex — WAD-precision cumulative rewards per active seat since genesis.
///                 Increases on each deposit: globalIndex += (amount * 1e18) / activeSeatCount
///   seatIndex[id] — snapshot of globalIndex at the last accrual reset for this seat.
///   claimable[owner] — banked token amounts ready to withdraw.
///
/// Accrual rules:
///   ACTIVE seats accrue continuously.
///   GRACE pauses accrual; the gap is NOT retroactively filled on resume.
///   Ownership transfer atomically banks old owner and starts new owner.
///   Foreclosure banks any remaining (should be 0; already banked at grace entry).
///
/// Precision:
///   Index uses WAD (1e18) scaling. Pending/banked amounts are in raw token units.
///   Rounding is floor (truncated). Dust per seat per deposit is at most 1 token unit.
contract RewardAccounting is IRewardAccounting, Ownable {
    using SafeERC20 for IERC20;

    // ─── Immutables ───────────────────────────────────────────────────────────

    IERC20 public immutable rewardToken;

    // ─── State ────────────────────────────────────────────────────────────────

    /// @notice Authorized Board_v2 contract. Only it may call lifecycle hooks.
    address public board;

    /// @dev WAD-precision cumulative rewards per seat since genesis.
    uint256 public globalIndex;

    /// @dev globalIndex snapshot when this seat's accrual last reset.
    mapping(uint256 => uint256) public seatIndex;

    /// @dev Whether this seat is currently accruing.
    mapping(uint256 => bool) public accruing;

    /// @dev Banked reward token amounts per owner, ready to claim.
    mapping(address => uint256) public claimable;

    /// @dev Number of seats currently accruing. Used to distribute deposits.
    uint256 public activeSeatCount;

    /// @dev Total reward tokens ever deposited (for invariant verification).
    uint256 public totalDeposited;

    // ─── Errors ───────────────────────────────────────────────────────────────

    error OnlyBoard();
    error BoardAlreadySet();
    error ZeroAddress();
    error NoRewards();

    // ─── Events ───────────────────────────────────────────────────────────────

    event BoardSet(address indexed board);
    event RewardDeposited(uint256 amount, uint256 newGlobalIndex, uint256 activeSeatCount);
    event EarningsBanked(uint256 indexed seatId, address indexed owner, uint256 amount);
    event RewardClaimed(address indexed owner, uint256 amount);
    event SeatStartedAccruing(uint256 indexed seatId, address indexed owner);
    event SeatStoppedAccruing(uint256 indexed seatId, address indexed owner);

    // ─── Modifiers ────────────────────────────────────────────────────────────

    modifier onlyBoard() {
        if (msg.sender != board) revert OnlyBoard();
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(address _rewardToken, address _admin) Ownable(_admin) {
        if (_rewardToken == address(0)) revert ZeroAddress();
        rewardToken = IERC20(_rewardToken);
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    /// @notice Set the authorized Board_v2 address. One-time; cannot be changed after set.
    function setBoard(address _board) external onlyOwner {
        if (board != address(0)) revert BoardAlreadySet();
        if (_board == address(0)) revert ZeroAddress();
        board = _board;
        emit BoardSet(_board);
    }

    // ─── Deposit ──────────────────────────────────────────────────────────────

    /// @notice Deposit reward tokens and distribute to active seats.
    ///         Permissionless — anyone may call (BoardRewardsVault is the expected caller).
    ///         Tokens are pulled from msg.sender; caller must have approved this contract.
    ///         If activeSeatCount == 0, tokens are held but unindexed (distribution skipped).
    function deposit(uint256 amount) external override {
        if (amount == 0) return;
        rewardToken.safeTransferFrom(msg.sender, address(this), amount);
        totalDeposited += amount;
        if (activeSeatCount > 0) {
            // WAD precision: each seat earns amount/activeSeatCount token units
            globalIndex += (amount * 1e18) / activeSeatCount;
        }
        emit RewardDeposited(amount, globalIndex, activeSeatCount);
    }

    // ─── Lifecycle Hooks (onlyBoard) ──────────────────────────────────────────

    /// @notice VACANT → ACTIVE: begin accrual for this seat.
    function onSeatActivated(uint256 seatId, address owner) external override onlyBoard {
        seatIndex[seatId] = globalIndex;
        accruing[seatId] = true;
        activeSeatCount++;
        emit SeatStartedAccruing(seatId, owner);
    }

    /// @notice Takeover (ACTIVE → ACTIVE, new owner):
    ///         Bank old owner's earnings; start new owner's accrual from current index.
    function onOwnershipTransfer(uint256 seatId, address oldOwner, address newOwner)
        external
        override
        onlyBoard
    {
        _bank(seatId, oldOwner);
        seatIndex[seatId] = globalIndex;
        // activeSeatCount unchanged; accruing stays true
        emit SeatStartedAccruing(seatId, newOwner);
    }

    /// @notice ACTIVE → GRACE: bank earnings and pause accrual.
    function onGraceEntered(uint256 seatId, address owner) external override onlyBoard {
        _bank(seatId, owner);
        accruing[seatId] = false;
        activeSeatCount--;
        emit SeatStoppedAccruing(seatId, owner);
    }

    /// @notice GRACE → ACTIVE (top-up): resume accrual from current globalIndex.
    ///         The gap during grace is not retroactively filled.
    function onSeatResumed(uint256 seatId, address owner) external override onlyBoard {
        seatIndex[seatId] = globalIndex;
        accruing[seatId] = true;
        activeSeatCount++;
        emit SeatStartedAccruing(seatId, owner);
    }

    /// @notice Foreclosure (GRACE → VACANT): seat was already not accruing since grace entry.
    ///         Any dust remaining is banked (normally 0 since grace hook already banked).
    function onSeatForeclosed(uint256 seatId, address oldOwner) external override onlyBoard {
        if (accruing[seatId]) {
            // Safety path: if somehow not synced before foreclose, bank and deactivate
            _bank(seatId, oldOwner);
            accruing[seatId] = false;
            activeSeatCount--;
        }
        seatIndex[seatId] = 0;
        emit SeatStoppedAccruing(seatId, oldOwner);
    }

    // ─── Claim ────────────────────────────────────────────────────────────────

    /// @notice Claim all banked rewards. Does not include pending (un-banked) seat earnings.
    ///         To claim pending earnings for owned seats, the seat must first be banked
    ///         (happens automatically on takeover, grace entry, or foreclosure).
    function claim() external {
        uint256 amount = claimable[msg.sender];
        if (amount == 0) revert NoRewards();
        claimable[msg.sender] = 0;
        rewardToken.safeTransfer(msg.sender, amount);
        emit RewardClaimed(msg.sender, amount);
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    /// @notice Pending (not yet banked) earnings for a seat.
    ///         Returns 0 if the seat is not accruing.
    function pendingForSeat(uint256 seatId) external view returns (uint256) {
        if (!accruing[seatId]) return 0;
        return _pendingAmount(seatId);
    }

    /// @notice Total claimable for an owner: banked + pending from a specific seat.
    function totalEarned(uint256 seatId, address owner) external view returns (uint256) {
        uint256 pending = accruing[seatId] ? _pendingAmount(seatId) : 0;
        return claimable[owner] + pending;
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    function _pendingAmount(uint256 seatId) internal view returns (uint256) {
        uint256 delta = globalIndex - seatIndex[seatId];
        return delta / 1e18;
    }

    function _bank(uint256 seatId, address owner) internal {
        uint256 pending = _pendingAmount(seatId);
        if (pending > 0) {
            claimable[owner] += pending;
            emit EarningsBanked(seatId, owner, pending);
        }
        seatIndex[seatId] = globalIndex;
    }
}
