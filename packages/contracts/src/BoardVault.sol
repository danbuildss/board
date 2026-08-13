// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IRewardAccounting} from "./IRewardAccounting.sol";
import {MockStrategyAdapter} from "./MockStrategyAdapter.sol";

/// @notice Holds realized Board rewards and streams them linearly to RewardAccounting.
///
/// Smoothing design:
///   collectAndDeposit() harvests from the strategy, rolls any unstreamed balance
///   plus the new harvest into a fresh linear stream of `streamDuration` seconds.
///   drip() releases the vested portion to RewardAccounting at any time (permissionless).
///
/// Setting streamDuration = 0 disables smoothing: drip() releases the full
/// pending balance immediately (useful in tests and simulator scenarios).
///
/// Purpose of smoothing:
///   Rewards arrive irregularly (e.g. single large harvests). Streaming them
///   prevents reward sniping (taking a Seat just before a large drop) and
///   reduces MEV opportunities around harvest timing.
contract BoardVault is Ownable {
    using SafeERC20 for IERC20;

    // ─── Immutables ───────────────────────────────────────────────────────────

    IERC20 public immutable rewardToken;
    MockStrategyAdapter public immutable strategy;
    IRewardAccounting public immutable rewardAccounting;

    // ─── Stream state ─────────────────────────────────────────────────────────

    /// @notice Seconds over which each harvest is streamed. 0 = no smoothing.
    uint256 public streamDuration;

    /// @dev Total tokens in the current stream (at the moment collectAndDeposit last ran).
    uint256 public streamTotal;

    /// @dev How many tokens from streamTotal have already been released to RewardAccounting.
    uint256 public streamReleased;

    /// @dev Timestamp when the current stream ends (streamStart = streamEnd - streamDuration).
    uint256 public streamEnd;

    // ─── Accounting ───────────────────────────────────────────────────────────

    /// @notice Cumulative tokens ever harvested from the strategy.
    uint256 public totalCollected;

    /// @notice Cumulative tokens ever deposited into RewardAccounting.
    uint256 public totalDeposited;

    // ─── Errors ───────────────────────────────────────────────────────────────

    error ZeroAddress();

    // ─── Events ───────────────────────────────────────────────────────────────

    event Collected(uint256 harvested, uint256 newStreamTotal, uint256 newStreamEnd);
    event Dripped(uint256 amount);
    event StreamDurationUpdated(uint256 oldDuration, uint256 newDuration);

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(
        address _rewardToken,
        address _strategy,
        address _rewardAccounting,
        uint256 _streamDuration,
        address _admin
    ) Ownable(_admin) {
        if (_rewardToken == address(0)) revert ZeroAddress();
        if (_strategy == address(0)) revert ZeroAddress();
        if (_rewardAccounting == address(0)) revert ZeroAddress();
        rewardToken = IERC20(_rewardToken);
        strategy = MockStrategyAdapter(_strategy);
        rewardAccounting = IRewardAccounting(_rewardAccounting);
        streamDuration = _streamDuration;
    }

    // ─── Admin ────────────────────────────────────────────────────────────────

    /// @notice Update the stream window. Takes effect on next collectAndDeposit.
    function setStreamDuration(uint256 _streamDuration) external onlyOwner {
        emit StreamDurationUpdated(streamDuration, _streamDuration);
        streamDuration = _streamDuration;
    }

    // ─── Core ─────────────────────────────────────────────────────────────────

    /// @notice Amount currently vested and ready to drip to RewardAccounting.
    function releasable() public view returns (uint256) {
        uint256 pending = streamTotal - streamReleased;
        if (pending == 0) return 0;
        // No smoothing or stream has ended: everything is releasable.
        if (streamDuration == 0 || block.timestamp >= streamEnd) return pending;
        uint256 streamStart = streamEnd - streamDuration;
        uint256 elapsed = block.timestamp - streamStart;
        uint256 vested = (streamTotal * elapsed) / streamDuration;
        if (vested <= streamReleased) return 0;
        return vested - streamReleased;
    }

    /// @notice Release vested rewards to RewardAccounting.
    ///         Permissionless — anyone can call to keep the stream flowing.
    function drip() public returns (uint256 amount) {
        amount = releasable();
        if (amount == 0) return 0;
        streamReleased += amount;
        totalDeposited += amount;
        rewardToken.safeIncreaseAllowance(address(rewardAccounting), amount);
        rewardAccounting.deposit(amount);
        emit Dripped(amount);
    }

    /// @notice Harvest from the strategy and roll into a fresh stream.
    ///         Calls drip() first to flush any vested amount, then adds the
    ///         new harvest plus any unstreamed remainder into a new stream
    ///         starting now and ending streamDuration seconds from now.
    ///         Permissionless — BoardVault is an open orchestrator.
    function collectAndDeposit() external returns (uint256 harvested) {
        // Flush vested rewards first so the unstreamed remainder is up to date.
        drip();

        harvested = strategy.harvest(address(this));
        if (harvested == 0) return 0;

        totalCollected += harvested;

        // Roll unstreamed remainder + new harvest into a fresh stream.
        uint256 remaining = streamTotal - streamReleased;
        streamTotal = remaining + harvested;
        streamReleased = 0;
        streamEnd = block.timestamp + streamDuration;

        emit Collected(harvested, streamTotal, streamEnd);

        // If streamDuration is 0, release immediately.
        if (streamDuration == 0) drip();
    }
}
