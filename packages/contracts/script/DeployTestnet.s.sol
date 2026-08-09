// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Board} from "../src/Board.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

/// @notice Deploy Board to Robinhood Chain testnet.
///
/// Required env vars:
///   DEPLOYER_PRIVATE_KEY  — funded testnet wallet
///   TREASURY              — address that receives protocol fees
///
/// Optional env vars (with defaults for testnet):
///   SETTLEMENT_ASSET      — override default testnet USDG address
///   VACANT_SEAT_PRICE     — default: 10_000_000 (10 USDG, 6 decimals)
///   DEPLOY_MOCK_USDC      — set to "true" to deploy MockUSDC instead of using USDG
///   ADMIN                 — defaults to deployer
contract DeployTestnet is Script {
    // Official Robinhood Chain testnet USDG (Paxos Global Dollar)
    address constant TESTNET_USDG = 0x7E955252E15c84f5768B83c41a71F9eba181802F;

    // $10.00 with 6 decimals
    uint256 constant DEFAULT_VACANT_PRICE = 10_000_000;

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address treasury = vm.envAddress("TREASURY");
        address admin = vm.envOr("ADMIN", deployer);
        uint256 vacantSeatPrice = vm.envOr("VACANT_SEAT_PRICE", DEFAULT_VACANT_PRICE);
        bool deployMock = keccak256(bytes(vm.envOr("DEPLOY_MOCK_USDC", string("false"))))
            == keccak256(bytes("true"));

        vm.startBroadcast(deployerKey);

        address settlementAsset;

        if (deployMock) {
            MockUSDC mock = new MockUSDC();
            settlementAsset = address(mock);
            // Mint 1M USDC to deployer for testing
            mock.mint(deployer, 1_000_000 * 1e6);
            console.log("MockUSDC deployed:", settlementAsset);
            console.log("  Minted 1,000,000 USDC to deployer:", deployer);
        } else {
            settlementAsset = vm.envOr("SETTLEMENT_ASSET", TESTNET_USDG);
            console.log("Using settlement asset:", settlementAsset);
        }

        Board board = new Board(settlementAsset, vacantSeatPrice, treasury, admin);

        vm.stopBroadcast();

        console.log("=== Robinhood Chain Testnet Deployment ===");
        console.log("Chain ID:        ", block.chainid);
        console.log("Deployer:        ", deployer);
        console.log("Settlement asset:", settlementAsset);
        console.log("Vacant seat $:   ", vacantSeatPrice);
        console.log("Treasury:        ", treasury);
        console.log("Admin:           ", admin);
        console.log("Board:           ", address(board));
        console.log("Block:           ", block.number);
    }
}
