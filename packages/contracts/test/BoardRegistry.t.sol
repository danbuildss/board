// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {BoardRegistry} from "../src/BoardRegistry.sol";

contract BoardRegistryTest is Test {
    BoardRegistry public registry;

    address admin    = makeAddr("admin");
    address nonAdmin = makeAddr("nonAdmin");
    address core     = makeAddr("boardCore");
    address settle   = makeAddr("settlement");
    address reward   = makeAddr("reward");
    address strat    = makeAddr("strategy");

    function setUp() public {
        registry = new BoardRegistry(admin);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    function _register() internal returns (uint256 id) {
        vm.prank(admin);
        id = registry.registerBoard(
            "GENESIS",
            "NVDA/USDG",
            100,
            settle,
            reward,
            strat,
            core,
            10e6,    // $10 vacant price (USDC 6 decimals)
            50,      // 0.5% per week
            72 hours
        );
    }

    // ─── Registration ─────────────────────────────────────────────────────────

    function test_RegisterBoard_ReturnsId1() public {
        uint256 id = _register();
        assertEq(id, 1);
        assertEq(registry.boardCount(), 1);
    }

    function test_RegisterBoard_StoresConfig() public {
        uint256 id = _register();
        BoardRegistry.BoardConfig memory cfg = registry.getBoard(id);

        assertEq(cfg.boardId, 1);
        assertEq(cfg.name, "GENESIS");
        assertEq(cfg.marketSymbol, "NVDA/USDG");
        assertEq(cfg.seatCount, 100);
        assertEq(cfg.settlementAsset, settle);
        assertEq(cfg.rewardAsset, reward);
        assertEq(cfg.strategyAdapter, strat);
        assertEq(cfg.boardCore, core);
        assertEq(cfg.vacantPrice, 10e6);
        assertEq(cfg.holdingRateBps, 50);
        assertEq(cfg.gracePeriod, 72 hours);
        assertEq(uint8(cfg.status), uint8(BoardRegistry.BoardStatus.PENDING));
    }

    function test_RegisterBoard_EmitsEvent() public {
        vm.expectEmit(true, true, false, true);
        emit BoardRegistry.BoardRegistered(1, "GENESIS", core);
        _register();
    }

    function test_RegisterBoard_MultipleBoards() public {
        _register();

        vm.prank(admin);
        uint256 id2 = registry.registerBoard(
            "BOARD 2", "AAPL/USDG", 100, settle, reward, strat, core, 10e6, 50, 72 hours
        );
        assertEq(id2, 2);
        assertEq(registry.boardCount(), 2);
    }

    function test_RegisterBoard_RevertsIfNotAdmin() public {
        vm.prank(nonAdmin);
        vm.expectRevert();
        registry.registerBoard("X", "Y", 100, settle, reward, strat, core, 10e6, 50, 72 hours);
    }

    function test_RegisterBoard_RevertsIfZeroSettlementAsset() public {
        vm.prank(admin);
        vm.expectRevert(BoardRegistry.ZeroAddress.selector);
        registry.registerBoard("X", "Y", 100, address(0), reward, strat, core, 10e6, 50, 72 hours);
    }

    function test_RegisterBoard_RevertsIfZeroBoardCore() public {
        vm.prank(admin);
        vm.expectRevert(BoardRegistry.ZeroAddress.selector);
        registry.registerBoard("X", "Y", 100, settle, reward, strat, address(0), 10e6, 50, 72 hours);
    }

    function test_RegisterBoard_RevertsIfZeroSeatCount() public {
        vm.prank(admin);
        vm.expectRevert(BoardRegistry.InvalidSeatCount.selector);
        registry.registerBoard("X", "Y", 0, settle, reward, strat, core, 10e6, 50, 72 hours);
    }

    function test_RegisterBoard_RevertsIfHoldingRateZero() public {
        vm.prank(admin);
        vm.expectRevert(BoardRegistry.InvalidHoldingRate.selector);
        registry.registerBoard("X", "Y", 100, settle, reward, strat, core, 10e6, 0, 72 hours);
    }

    function test_RegisterBoard_RevertsIfHoldingRateOver100Pct() public {
        vm.prank(admin);
        vm.expectRevert(BoardRegistry.InvalidHoldingRate.selector);
        registry.registerBoard("X", "Y", 100, settle, reward, strat, core, 10e6, 10_001, 72 hours);
    }

    // ─── Status ───────────────────────────────────────────────────────────────

    function test_SetStatus_UpdatesStatus() public {
        uint256 id = _register();
        vm.prank(admin);
        registry.setStatus(id, BoardRegistry.BoardStatus.ACTIVE);
        assertEq(uint8(registry.getBoard(id).status), uint8(BoardRegistry.BoardStatus.ACTIVE));
    }

    function test_SetStatus_EmitsEvent() public {
        uint256 id = _register();
        vm.expectEmit(true, false, false, true);
        emit BoardRegistry.BoardStatusUpdated(id, BoardRegistry.BoardStatus.ACTIVE);
        vm.prank(admin);
        registry.setStatus(id, BoardRegistry.BoardStatus.ACTIVE);
    }

    function test_SetStatus_RevertsIfNotAdmin() public {
        uint256 id = _register();
        vm.prank(nonAdmin);
        vm.expectRevert();
        registry.setStatus(id, BoardRegistry.BoardStatus.ACTIVE);
    }

    function test_SetStatus_RevertsIfBoardNotFound() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(BoardRegistry.BoardNotFound.selector, 99));
        registry.setStatus(99, BoardRegistry.BoardStatus.ACTIVE);
    }

    // ─── Strategy update ──────────────────────────────────────────────────────

    function test_SetStrategyAdapter_Updates() public {
        uint256 id = _register();
        address newStrat = makeAddr("newStrat");
        vm.prank(admin);
        registry.setStrategyAdapter(id, newStrat);
        assertEq(registry.getBoard(id).strategyAdapter, newStrat);
    }

    function test_SetStrategyAdapter_EmitsEvent() public {
        uint256 id = _register();
        address newStrat = makeAddr("newStrat");
        vm.expectEmit(true, false, false, true);
        emit BoardRegistry.BoardStrategyUpdated(id, newStrat);
        vm.prank(admin);
        registry.setStrategyAdapter(id, newStrat);
    }

    function test_SetStrategyAdapter_RevertsIfNotAdmin() public {
        uint256 id = _register();
        vm.prank(nonAdmin);
        vm.expectRevert();
        registry.setStrategyAdapter(id, makeAddr("x"));
    }

    function test_SetStrategyAdapter_RevertsIfNotFound() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(BoardRegistry.BoardNotFound.selector, 1));
        registry.setStrategyAdapter(1, makeAddr("x"));
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    function test_GetBoard_RevertsIfNotFound() public {
        vm.expectRevert(abi.encodeWithSelector(BoardRegistry.BoardNotFound.selector, 1));
        registry.getBoard(1);
    }

    function test_GetActiveBoards_Empty() public view {
        BoardRegistry.BoardConfig[] memory result = registry.getActiveBoards();
        assertEq(result.length, 0);
    }

    function test_GetActiveBoards_ReturnsOnlyActive() public {
        _register(); // id 1: PENDING

        vm.prank(admin);
        uint256 id2 = registry.registerBoard(
            "BOARD 2", "X/Y", 50, settle, reward, strat, core, 5e6, 50, 72 hours
        );
        vm.prank(admin);
        registry.setStatus(1, BoardRegistry.BoardStatus.ACTIVE);
        vm.prank(admin);
        registry.setStatus(id2, BoardRegistry.BoardStatus.PAUSED);

        BoardRegistry.BoardConfig[] memory active = registry.getActiveBoards();
        assertEq(active.length, 1);
        assertEq(active[0].boardId, 1);
    }

    function test_GetActiveBoards_AllActive() public {
        _register();
        vm.prank(admin);
        registry.registerBoard("B2", "X/Y", 50, settle, reward, strat, core, 5e6, 50, 72 hours);

        vm.prank(admin); registry.setStatus(1, BoardRegistry.BoardStatus.ACTIVE);
        vm.prank(admin); registry.setStatus(2, BoardRegistry.BoardStatus.ACTIVE);

        assertEq(registry.getActiveBoards().length, 2);
    }

    // ─── Fuzz ─────────────────────────────────────────────────────────────────

    function testFuzz_RegisterBoard_HoldingRateBounds(uint256 bps) public {
        bps = bound(bps, 1, 10_000);
        vm.prank(admin);
        uint256 id = registry.registerBoard("X", "Y", 100, settle, reward, strat, core, 10e6, bps, 72 hours);
        assertEq(registry.getBoard(id).holdingRateBps, bps);
    }

    function testFuzz_RegisterBoard_MultipleBoards(uint8 count) public {
        count = uint8(bound(count, 1, 10));
        for (uint256 i = 0; i < count; i++) {
            vm.prank(admin);
            registry.registerBoard("X", "Y", 100, settle, reward, strat, core, 10e6, 50, 72 hours);
        }
        assertEq(registry.boardCount(), count);
    }
}
