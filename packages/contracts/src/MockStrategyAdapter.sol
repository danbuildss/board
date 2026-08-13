// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {MockRewardToken} from "./MockRewardToken.sol";

/// @notice Simulates a productive onchain market position.
///         Owner calls simulateYield() to stage pending rewards (as a real strategy would accrue).
///         Anyone calls harvest(to) to mint the pending rewards to a recipient.
///         In production this adapter would call out to a real yield-bearing position.
contract MockStrategyAdapter is Ownable {
    MockRewardToken public immutable rewardToken;
    uint256 public pendingRewards;

    event YieldSimulated(uint256 amount, uint256 total);
    event Harvested(address indexed to, uint256 amount);

    constructor(address _rewardToken, address _admin) Ownable(_admin) {
        rewardToken = MockRewardToken(_rewardToken);
    }

    /// @notice Stage additional pending rewards (simulates yield accumulating in a real strategy).
    function simulateYield(uint256 amount) external onlyOwner {
        pendingRewards += amount;
        emit YieldSimulated(amount, pendingRewards);
    }

    /// @notice Harvest all pending rewards, minting them to `to`.
    ///         Returns the amount harvested (0 if nothing pending).
    function harvest(address to) external returns (uint256 amount) {
        amount = pendingRewards;
        if (amount == 0) return 0;
        pendingRewards = 0;
        rewardToken.mint(to, amount);
        emit Harvested(to, amount);
    }
}
