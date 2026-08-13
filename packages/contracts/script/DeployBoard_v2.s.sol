// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {MockRewardToken}    from "../src/MockRewardToken.sol";
import {MockStrategyAdapter} from "../src/MockStrategyAdapter.sol";
import {RewardAccounting}   from "../src/RewardAccounting.sol";
import {Board_v2}           from "../src/Board_v2.sol";
import {BoardVault}         from "../src/BoardVault.sol";
import {BoardRegistry}      from "../src/BoardRegistry.sol";

/// @notice Deploy the full Board_v2 reward suite to Robinhood Chain testnet.
///
/// Required env vars:
///   DEPLOYER_PRIVATE_KEY  — funded testnet wallet
///   TREASURY              — address that receives protocol fees
///
/// Optional env vars (all have sensible testnet defaults):
///   SETTLEMENT_ASSET      — override USDG (default: 0x7E955252E15c84f5768B83c41a71F9eba181802F)
///   VACANT_SEAT_PRICE     — default: 10_000_000 (10 USDG, 6 decimals)
///   STREAM_DURATION       — reward smoothing window in seconds (default: 604800 = 7 days, 0 = immediate)
///   ADMIN                 — defaults to deployer
contract DeployBoard_v2 is Script {
    address constant TESTNET_USDG    = 0x7E955252E15c84f5768B83c41a71F9eba181802F;
    uint256 constant DEFAULT_VACANT  = 10_000_000;      // $10.00 (6 decimals)
    uint256 constant DEFAULT_STREAM  = 7 days;
    uint256 constant HOLDING_BPS     = 50;              // 0.5% per week
    uint256 constant GRACE_PERIOD    = 3 days;          // 72 hours

    function run() external {
        uint256 deployerKey   = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer      = vm.addr(deployerKey);
        address treasury      = vm.envAddress("TREASURY");
        address admin         = vm.envOr("ADMIN", deployer);
        address settlement    = vm.envOr("SETTLEMENT_ASSET", TESTNET_USDG);
        uint256 vacantPrice   = vm.envOr("VACANT_SEAT_PRICE", DEFAULT_VACANT);
        uint256 streamDur     = vm.envOr("STREAM_DURATION", DEFAULT_STREAM);

        vm.startBroadcast(deployerKey);

        // 1. Deploy MockRewardToken — minter will be set to the strategy adapter
        MockRewardToken rewardToken = new MockRewardToken(admin);

        // 2. Deploy MockStrategyAdapter — calls rewardToken.mint on harvest
        MockStrategyAdapter strategy = new MockStrategyAdapter(address(rewardToken), admin);

        // 3. Wire MockRewardToken: only the strategy may mint
        rewardToken.setMinter(address(strategy));

        // 4. Deploy RewardAccounting — board will be wired after Board_v2 deploy
        RewardAccounting ra = new RewardAccounting(address(rewardToken), admin);

        // 5. Deploy Board_v2 — same constructor as Board.sol; reward accounting wired below
        Board_v2 board = new Board_v2(settlement, vacantPrice, treasury, admin);

        // 6. Wire Board_v2 ↔ RewardAccounting (one-time sets, order matters)
        ra.setBoard(address(board));
        board.setRewardAccounting(address(ra));

        // 7. Deploy BoardVault — orchestrates harvest → smooth → deposit
        BoardVault vault = new BoardVault(
            address(rewardToken),
            address(strategy),
            address(ra),
            streamDur,
            admin
        );

        // 8. Deploy BoardRegistry and register HOOD Board
        BoardRegistry registry = new BoardRegistry(admin);
        uint256 boardId = registry.registerBoard(
            "HOOD Board",
            "HOOD",
            100,                    // seatCount
            settlement,             // settlementAsset
            address(rewardToken),   // rewardAsset
            address(strategy),      // strategyAdapter
            address(board),         // boardCore
            vacantPrice,            // vacantPrice
            HOLDING_BPS,            // holdingRateBps (50 = 0.5%/week)
            GRACE_PERIOD            // gracePeriod (72h)
        );
        registry.setStatus(boardId, BoardRegistry.BoardStatus.ACTIVE);

        vm.stopBroadcast();

        console.log("=== Board_v2 Suite Deployment ===");
        console.log("Chain ID:           ", block.chainid);
        console.log("Deployer:           ", deployer);
        console.log("Admin:              ", admin);
        console.log("Treasury:           ", treasury);
        console.log("Settlement asset:   ", settlement);
        console.log("Vacant seat price:  ", vacantPrice);
        console.log("Stream duration:    ", streamDur, "seconds");
        console.log("---");
        console.log("MockRewardToken:    ", address(rewardToken));
        console.log("MockStrategyAdapter:", address(strategy));
        console.log("RewardAccounting:   ", address(ra));
        console.log("Board_v2:           ", address(board));
        console.log("BoardVault:         ", address(vault));
        console.log("BoardRegistry:      ", address(registry));
        console.log("Registry boardId:   ", boardId);
        console.log("Deployment block:   ", block.number);
    }
}
