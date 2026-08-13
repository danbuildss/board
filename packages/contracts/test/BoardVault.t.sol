// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {BoardVault} from "../src/BoardVault.sol";
import {RewardAccounting} from "../src/RewardAccounting.sol";
import {MockStrategyAdapter} from "../src/MockStrategyAdapter.sol";
import {MockRewardToken} from "../src/MockRewardToken.sol";
import {IRewardAccounting} from "../src/IRewardAccounting.sol";

/// @dev Minimal Board stub that calls onSeatActivated so activeSeatCount > 0.
contract MockBoard {
    IRewardAccounting ra;
    constructor(address _ra) { ra = IRewardAccounting(_ra); }
    function activateSeat(uint256 id, address owner) external {
        ra.onSeatActivated(id, owner);
    }
}

contract BoardVaultBase is Test {
    MockRewardToken   public token;
    MockStrategyAdapter public strategy;
    RewardAccounting  public ra;
    BoardVault        public vault;
    MockBoard         public board;

    address admin = makeAddr("admin");
    address alice = makeAddr("alice");

    // Fixed start time used by all time-sensitive tests.
    // Avoids via_ir caching block.timestamp at point-of-use when captured in a local.
    uint256 constant T0 = 1_000_000;

    function _setUp(uint256 streamDuration) internal {
        vm.warp(T0); // all timestamp arithmetic starts from this known base

        token    = new MockRewardToken(admin);
        ra       = new RewardAccounting(address(token), admin);
        strategy = new MockStrategyAdapter(address(token), admin);
        vault    = new BoardVault(address(token), address(strategy), address(ra), streamDuration, admin);
        board    = new MockBoard(address(ra));

        vm.prank(admin); token.setMinter(address(strategy));
        vm.prank(admin); ra.setBoard(address(board));
    }

    function _activateSeat(uint256 id, address owner) internal {
        board.activateSeat(id, owner);
    }
}

// ─── No smoothing (streamDuration = 0) ───────────────────────────────────────

contract BoardVault_NoSmoothingTest is BoardVaultBase {
    function setUp() public { _setUp(0); }

    function test_CollectAndDeposit_ImmediateRelease() public {
        _activateSeat(1, alice);

        vm.prank(admin); strategy.simulateYield(1000e18);
        vault.collectAndDeposit();

        // With streamDuration=0, everything should be deposited immediately
        assertEq(ra.globalIndex(), (1000e18 * 1e18) / 1); // 1 active seat
        assertEq(vault.totalCollected(), 1000e18);
        assertEq(vault.totalDeposited(), 1000e18);
        assertEq(vault.streamTotal() - vault.streamReleased(), 0); // nothing pending
    }

    function test_CollectAndDeposit_NothingPending_IsNoOp() public {
        uint256 harvested = vault.collectAndDeposit();
        assertEq(harvested, 0);
        assertEq(vault.totalCollected(), 0);
    }

    function test_Drip_WhenNothingPending_ReturnsZero() public {
        assertEq(vault.drip(), 0);
    }

    function test_MultipleCollects_EachDepositedImmediately() public {
        _activateSeat(1, alice);

        vm.prank(admin); strategy.simulateYield(500e18);
        vault.collectAndDeposit();

        vm.prank(admin); strategy.simulateYield(300e18);
        vault.collectAndDeposit();

        assertEq(vault.totalCollected(), 800e18);
        assertEq(vault.totalDeposited(), 800e18);
    }
}

// ─── With smoothing (streamDuration = 7 days) ─────────────────────────────────

contract BoardVault_SmoothingTest is BoardVaultBase {
    uint256 constant STREAM = 7 days;

    function setUp() public { _setUp(STREAM); }

    function test_ReleasableIsZeroBeforeAnyCollect() public view {
        assertEq(vault.releasable(), 0);
    }

    function test_CollectAndDeposit_StartsStream_NothingReleasedYet() public {
        _activateSeat(1, alice);
        vm.prank(admin); strategy.simulateYield(700e18);
        vault.collectAndDeposit();

        // No time has passed — nothing vested yet
        assertEq(vault.releasable(), 0);
        assertEq(vault.totalDeposited(), 0);
        assertEq(vault.streamTotal(), 700e18);
        assertEq(vault.streamReleased(), 0);
    }

    function test_Releasable_AfterHalfDuration() public {
        _activateSeat(1, alice);
        vm.prank(admin); strategy.simulateYield(700e18);
        vault.collectAndDeposit(); // stream starts at T0

        vm.warp(T0 + 3.5 days);
        assertEq(vault.releasable(), 350e18); // 50% of 700
    }

    function test_Drip_AfterHalfDuration() public {
        _activateSeat(1, alice);
        vm.prank(admin); strategy.simulateYield(700e18);
        vault.collectAndDeposit();

        vm.warp(T0 + 3.5 days);
        uint256 released = vault.drip();
        assertEq(released, 350e18);
        assertEq(vault.totalDeposited(), 350e18);
        assertEq(vault.streamReleased(), 350e18);
    }

    function test_Drip_AfterFullDuration_ReleasesAll() public {
        _activateSeat(1, alice);
        vm.prank(admin); strategy.simulateYield(700e18);
        vault.collectAndDeposit();

        vm.warp(T0 + STREAM);
        uint256 released = vault.drip();
        assertEq(released, 700e18);
        assertEq(vault.streamReleased(), vault.streamTotal());
    }

    function test_Drip_AfterFullDuration_SameResult() public {
        _activateSeat(1, alice);
        vm.prank(admin); strategy.simulateYield(700e18);
        vault.collectAndDeposit();

        vm.warp(T0 + 14 days); // 2× the stream window
        uint256 released = vault.drip();
        assertEq(released, 700e18); // capped at stream total
    }

    function test_Drip_MultipleCalls_DoNotDoubleRelease() public {
        _activateSeat(1, alice);
        vm.prank(admin); strategy.simulateYield(700e18);
        vault.collectAndDeposit();

        vm.warp(T0 + 3.5 days);
        vault.drip();

        // Second drip immediately — nothing new vested
        assertEq(vault.drip(), 0);

        vm.warp(T0 + 7 days); // full stream duration
        uint256 second = vault.drip();
        assertEq(second, 350e18); // remaining 50%
        assertEq(vault.totalDeposited(), 700e18);
    }

    function test_SecondCollect_RollsUnstreamedIntoNewStream() public {
        _activateSeat(1, alice);
        vm.prank(admin); strategy.simulateYield(700e18);
        vault.collectAndDeposit(); // stream: T0 → T0+7d

        vm.warp(T0 + 3.5 days);
        vm.prank(admin); strategy.simulateYield(300e18);
        vault.collectAndDeposit();
        // drip() inside released 350; new stream: (700-350)+300=650 over 7d
        assertEq(vault.streamTotal(), 650e18);
        assertEq(vault.streamReleased(), 0);
        assertEq(vault.totalDeposited(), 350e18);
        assertEq(vault.totalCollected(), 1000e18);
    }

    function test_SecondCollect_NewStreamVestsCorrectly() public {
        _activateSeat(1, alice);
        vm.prank(admin); strategy.simulateYield(700e18);
        vault.collectAndDeposit(); // stream: T0 → T0+7d

        vm.warp(T0 + 3.5 days);
        vm.prank(admin); strategy.simulateYield(300e18);
        vault.collectAndDeposit(); // drips 350; new stream: 650 from T0+3.5d → T0+10.5d

        // 3.5 days into the new 7-day stream: 650 * 0.5 = 325
        vm.warp(T0 + 7 days);
        uint256 released = vault.drip();
        assertEq(released, 325e18);
    }

    function test_RewardsDistributeToSeatOwner() public {
        _activateSeat(1, alice);
        vm.prank(admin); strategy.simulateYield(700e18);
        vault.collectAndDeposit();

        vm.warp(T0 + STREAM);
        vault.drip();

        assertEq(ra.pendingForSeat(1), 700e18);
    }

    function test_SetStreamDuration_UpdatesForNextStream() public {
        _activateSeat(1, alice);
        vm.prank(admin); strategy.simulateYield(1000e18);
        vault.collectAndDeposit(); // 7-day stream

        // Admin changes to 14-day stream
        vm.prank(admin); vault.setStreamDuration(14 days);
        assertEq(vault.streamDuration(), 14 days);
    }

    function test_SetStreamDuration_RevertsIfNotAdmin() public {
        vm.prank(alice);
        vm.expectRevert();
        vault.setStreamDuration(1 days);
    }

    function test_Drip_IsPermissionless() public {
        _activateSeat(1, alice);
        vm.prank(admin); strategy.simulateYield(700e18);
        vault.collectAndDeposit();

        vm.warp(T0 + 7 days);
        address keeper = makeAddr("keeper");
        vm.prank(keeper);
        uint256 released = vault.drip();
        assertEq(released, 700e18);
    }
}

// ─── Constructor validation ────────────────────────────────────────────────────

contract BoardVault_ConstructorTest is BoardVaultBase {
    function setUp() public { _setUp(7 days); }

    function test_RevertsIfZeroRewardToken() public {
        vm.expectRevert(BoardVault.ZeroAddress.selector);
        new BoardVault(address(0), address(strategy), address(ra), 7 days, admin);
    }

    function test_RevertsIfZeroStrategy() public {
        vm.expectRevert(BoardVault.ZeroAddress.selector);
        new BoardVault(address(token), address(0), address(ra), 7 days, admin);
    }

    function test_RevertsIfZeroRewardAccounting() public {
        vm.expectRevert(BoardVault.ZeroAddress.selector);
        new BoardVault(address(token), address(strategy), address(0), 7 days, admin);
    }
}

// ─── Fuzz ─────────────────────────────────────────────────────────────────────

contract BoardVault_FuzzTest is BoardVaultBase {
    function setUp() public { _setUp(7 days); }

    function testFuzz_NeverReleaseMoreThanCollected(uint256 yield, uint256 warpSeconds) public {
        yield       = bound(yield, 1, 1_000_000e18);
        warpSeconds = bound(warpSeconds, 0, 30 days);

        _activateSeat(1, alice);
        vm.prank(admin); strategy.simulateYield(yield);
        vault.collectAndDeposit(); // stream starts at T0

        vm.warp(T0 + warpSeconds);
        vault.drip();

        assertLe(vault.totalDeposited(), vault.totalCollected());
        assertGe(vault.streamTotal(), vault.streamReleased());
    }

    function testFuzz_TwoCollects_NeverReleaseMoreThanTotal(
        uint256 yield1,
        uint256 yield2,
        uint256 warp1,
        uint256 warp2
    ) public {
        yield1 = bound(yield1, 0, 500_000e18);
        yield2 = bound(yield2, 0, 500_000e18);
        warp1  = bound(warp1, 0, 14 days);
        warp2  = bound(warp2, 0, 14 days);

        _activateSeat(1, alice);

        if (yield1 > 0) { vm.prank(admin); strategy.simulateYield(yield1); }
        vault.collectAndDeposit(); // stream starts at T0
        vm.warp(T0 + warp1);

        if (yield2 > 0) { vm.prank(admin); strategy.simulateYield(yield2); }
        vault.collectAndDeposit();
        vm.warp(T0 + warp1 + warp2);

        vault.drip();

        assertLe(vault.totalDeposited(), yield1 + yield2);
        assertGe(vault.streamTotal(), vault.streamReleased());
    }

    function testFuzz_StreamDurationZero_AlwaysReleasesAll(uint256 yield) public {
        // Re-deploy with 0 duration
        _setUp(0);
        yield = bound(yield, 1, 1_000_000e18);

        _activateSeat(1, alice);
        vm.prank(admin); strategy.simulateYield(yield);
        vault.collectAndDeposit();

        assertEq(vault.totalDeposited(), yield);
        assertEq(vault.streamReleased(), vault.streamTotal());
    }
}
