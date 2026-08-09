// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {Board} from "../src/Board.sol";

/**
 * @notice Deploy HOOD Board.
 *
 * Required env vars:
 *   SETTLEMENT_ASSET   — ERC-20 stable address on target chain
 *   TREASURY           — protocol fee recipient
 *   VACANT_SEAT_PRICE  — price in settlement asset units (e.g. 10000000 = $10 USDC with 6 dec)
 *   DEPLOYER_PRIVATE_KEY
 *
 * Usage (testnet):
 *   forge script script/DeployBoard.s.sol \
 *     --rpc-url $RPC_URL \
 *     --private-key $DEPLOYER_PRIVATE_KEY \
 *     --broadcast \
 *     --verify
 */
contract DeployBoard is Script {
    function run() external {
        address settlementAsset = vm.envAddress("SETTLEMENT_ASSET");
        address treasury        = vm.envAddress("TREASURY");
        uint256 vacantSeatPrice = vm.envUint("VACANT_SEAT_PRICE");
        address admin           = vm.envOr("ADMIN", msg.sender);

        vm.startBroadcast();

        Board board = new Board(settlementAsset, vacantSeatPrice, treasury, admin);

        console.log("Board deployed:", address(board));
        console.log("Settlement asset:", settlementAsset);
        console.log("Treasury:", treasury);
        console.log("Vacant seat price:", vacantSeatPrice);
        console.log("Admin:", admin);

        vm.stopBroadcast();
    }
}
