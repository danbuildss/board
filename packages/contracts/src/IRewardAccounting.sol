// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IRewardAccounting {
    // Called when a vacant seat is taken (VACANT → ACTIVE)
    function onSeatActivated(uint256 seatId, address owner) external;

    // Called on takeover (ACTIVE → ACTIVE, new owner)
    // Banks old owner's earnings; starts new owner's accrual
    function onOwnershipTransfer(uint256 seatId, address oldOwner, address newOwner) external;

    // Called when a seat enters grace (balance hits zero, ACTIVE → GRACE)
    // Banks owner's earnings; pauses accrual
    function onGraceEntered(uint256 seatId, address owner) external;

    // Called when a grace seat is topped up (GRACE → ACTIVE)
    // Resumes accrual from current globalIndex (gap not retroactively filled)
    function onSeatResumed(uint256 seatId, address owner) external;

    // Called when a seat is foreclosed (GRACE/FORECLOSABLE → VACANT)
    function onSeatForeclosed(uint256 seatId, address oldOwner) external;

    // Called by BoardRewardsVault to register a reward deposit
    function deposit(uint256 amount) external;

    // Whether a seat is currently accruing rewards
    function accruing(uint256 seatId) external view returns (bool);
}
