// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {MockStrategyAdapter} from "./MockStrategyAdapter.sol";
import {IRewardAccounting} from "./IRewardAccounting.sol";

/// @notice Collects rewards from the strategy and deposits them into RewardAccounting.
///         Anyone may call collectAndDeposit() — it is permissionless and beneficent.
///         In production this would integrate with a real yield strategy's harvest function.
contract BoardRewardsVault is Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable rewardToken;
    MockStrategyAdapter public immutable strategy;
    IRewardAccounting public immutable rewardAccounting;

    event Collected(uint256 amount);

    constructor(
        address _rewardToken,
        address _strategy,
        address _rewardAccounting,
        address _admin
    ) Ownable(_admin) {
        rewardToken = IERC20(_rewardToken);
        strategy = MockStrategyAdapter(_strategy);
        rewardAccounting = IRewardAccounting(_rewardAccounting);
    }

    /// @notice Harvest pending strategy rewards and deposit them into RewardAccounting.
    ///         Permissionless — callable by anyone (e.g., a keeper, cron, or user).
    function collectAndDeposit() external returns (uint256 amount) {
        // Harvest mints reward tokens directly to this vault
        amount = strategy.harvest(address(this));
        if (amount == 0) return 0;

        // Approve and deposit into RewardAccounting (which pulls from this vault)
        rewardToken.safeIncreaseAllowance(address(rewardAccounting), amount);
        rewardAccounting.deposit(amount);

        emit Collected(amount);
    }
}
