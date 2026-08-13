// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {Board_v2}          from "../src/Board_v2.sol";
import {RewardAccounting}  from "../src/RewardAccounting.sol";
import {MockRewardToken}   from "../src/MockRewardToken.sol";
import {MockStrategyAdapter} from "../src/MockStrategyAdapter.sol";
import {BoardRewardsVault} from "../src/BoardRewardsVault.sol";
import {ERC20}             from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// ── Minimal settlement token ──────────────────────────────────────────────────

contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

// ── Base fixture ──────────────────────────────────────────────────────────────

contract Board_v2_Test is Test {
    Board_v2            public board;
    RewardAccounting    public ra;
    MockRewardToken     public rewardToken;
    MockStrategyAdapter public strategy;
    BoardRewardsVault   public vault;
    MockUSDC            public usdc;

    address public treasury = makeAddr("treasury");
    address public admin    = makeAddr("admin");
    address public alice    = makeAddr("alice");
    address public bob      = makeAddr("bob");
    address public carol    = makeAddr("carol");
    address public dave     = makeAddr("dave");

    uint256 public constant VACANT_PRICE       = 10e6;
    uint256 public constant HOLDING_RATE_NUM   = 5;
    uint256 public constant HOLDING_RATE_DEN   = 1000;
    uint256 public constant HOLDING_PERIOD     = 604800;
    uint256 public constant GRACE_PERIOD       = 259200;
    uint256 public constant MIN_COVERAGE_WEEKS = 2;

    function setUp() public virtual {
        // Settlement asset
        usdc = new MockUSDC();

        // Board_v2 (no reward accounting yet)
        vm.prank(admin);
        board = new Board_v2(address(usdc), VACANT_PRICE, treasury, admin);

        // Reward stack
        vm.startPrank(admin);
        rewardToken = new MockRewardToken(admin);
        ra          = new RewardAccounting(address(rewardToken), admin);
        strategy    = new MockStrategyAdapter(address(rewardToken), admin);
        vault       = new BoardRewardsVault(address(rewardToken), address(strategy), address(ra), admin);

        rewardToken.setMinter(address(strategy));
        ra.setBoard(address(board));
        board.setRewardAccounting(address(ra));
        vm.stopPrank();

        // Fund wallets
        usdc.mint(alice, 10_000e6);
        usdc.mint(bob,   10_000e6);
        usdc.mint(carol, 10_000e6);
        usdc.mint(dave,  10_000e6);

        // Pre-approve board
        vm.prank(alice); usdc.approve(address(board), type(uint256).max);
        vm.prank(bob);   usdc.approve(address(board), type(uint256).max);
        vm.prank(carol); usdc.approve(address(board), type(uint256).max);
        vm.prank(dave);  usdc.approve(address(board), type(uint256).max);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    function minDeposit(uint256 price) internal pure returns (uint256) {
        return (price * HOLDING_RATE_NUM * MIN_COVERAGE_WEEKS) / HOLDING_RATE_DEN;
    }

    function aliceTakes(uint256 seatId, uint256 price) internal {
        vm.prank(alice);
        board.takeVacantSeat(seatId, price, minDeposit(price));
    }

    function simulateAndCollect(uint256 amount) internal {
        vm.prank(admin);
        strategy.simulateYield(amount);
        vault.collectAndDeposit();
    }

    // Warp to exactly when alice's seat depletes
    function warpToDepletion(uint256 seatId) internal {
        (, uint256 price, uint256 prepaid,,,,, ) = board.seatCoverage(seatId);
        uint256 elapsed = HOLDING_RATE_DEN * HOLDING_PERIOD * prepaid / (price * HOLDING_RATE_NUM);
        vm.warp(block.timestamp + elapsed + 1);
    }
}

// ════════════════════════════════════════════════════════════════════════════
// ADMIN
// ════════════════════════════════════════════════════════════════════════════

contract Board_v2_AdminTest is Board_v2_Test {
    function test_SetRewardAccounting_Stores() public {
        // Already set in setUp; verify
        assertEq(address(board.rewardAccounting()), address(ra));
    }

    function test_SetRewardAccounting_RevertsIfAlreadySet() public {
        vm.prank(admin);
        vm.expectRevert(Board_v2.RewardAccountingAlreadySet.selector);
        board.setRewardAccounting(makeAddr("other"));
    }

    function test_NoRA_BoardStillWorksNormally() public {
        // Deploy board without wiring RA
        vm.prank(admin);
        Board_v2 bare = new Board_v2(address(usdc), VACANT_PRICE, treasury, admin);
        usdc.mint(alice, 100e6);
        vm.prank(alice); usdc.approve(address(bare), type(uint256).max);
        vm.prank(alice); bare.takeVacantSeat(1, 100e6, minDeposit(100e6));
        assertEq(bare.ownerOf(1), alice);
    }
}

// ════════════════════════════════════════════════════════════════════════════
// TAKE VACANT SEAT — reward hooks
// ════════════════════════════════════════════════════════════════════════════

contract Board_v2_TakeVacantTest is Board_v2_Test {
    function test_TakeVacantSeat_TriggersOnSeatActivated() public {
        aliceTakes(1, 100e6);
        assertTrue(ra.accruing(1));
        assertEq(ra.activeSeatCount(), 1);
        assertEq(ra.seatIndex(1), 0); // globalIndex was 0
    }

    function test_TakeVacantSeat_EarnsFromNextDeposit() public {
        aliceTakes(1, 100e6);
        simulateAndCollect(300e18);
        assertEq(ra.pendingForSeat(1), 300e18); // only seat, gets all
    }

    function test_TakeVacantSeat_MultipleSeats_ShareRewards() public {
        aliceTakes(1, 100e6);
        vm.prank(bob); board.takeVacantSeat(2, 100e6, minDeposit(100e6));
        simulateAndCollect(200e18);
        assertEq(ra.pendingForSeat(1), 100e18);
        assertEq(ra.pendingForSeat(2), 100e18);
    }

    function test_TakeVacantSeat_AfterForeclosure_StartsClean() public {
        aliceTakes(1, 100e6);
        simulateAndCollect(100e18); // alice earns 100

        // Drain alice to grace, then foreclose
        warpToDepletion(1);
        vm.warp(block.timestamp + GRACE_PERIOD + 1);
        board.forecloseSeat(1);

        assertFalse(ra.accruing(1));

        // Bob takes vacant seat 1
        vm.prank(bob); board.takeVacantSeat(1, 50e6, minDeposit(50e6));
        assertTrue(ra.accruing(1));
        assertEq(ra.pendingForSeat(1), 0); // starts from current index, not alice's gap
    }
}

// ════════════════════════════════════════════════════════════════════════════
// TOP UP — grace → active reward sync
// ════════════════════════════════════════════════════════════════════════════

contract Board_v2_TopUpTest is Board_v2_Test {
    function test_TopUp_WhileActive_NoRewardChange() public {
        aliceTakes(1, 100e6);
        simulateAndCollect(100e18);
        uint256 pendingBefore = ra.pendingForSeat(1);

        vm.prank(alice); board.topUpSeat(1, 1e6);

        // Accrual still ongoing; seatIndex unchanged; pending unchanged
        assertEq(ra.pendingForSeat(1), pendingBefore);
        assertTrue(ra.accruing(1));
    }

    function test_TopUp_FromGrace_TriggersGraceEnteredThenResumed() public {
        aliceTakes(1, 100e6);
        simulateAndCollect(60e18);

        // Drain into grace
        warpToDepletion(1);
        // Seat is now in GRACE but ra still thinks it's accruing

        simulateAndCollect(40e18); // deposited while ra still thinks active; no active seats after sync

        // Top up triggers _syncGraceHook (onGraceEntered) then onSeatResumed
        vm.prank(alice); board.topUpSeat(1, 5e6);

        assertTrue(ra.accruing(1));
        assertEq(ra.activeSeatCount(), 1);
        // Alice's banked rewards: earned before depletion
        // After resume, pendingForSeat resets to 0 (resumes from current index)
        assertEq(ra.pendingForSeat(1), 0);
        // Claimable should contain what was earned before grace
        assertGt(ra.claimable(alice), 0);
    }

    function test_TopUp_FromGrace_FutureRewardsAccrue() public {
        aliceTakes(1, 100e6);
        warpToDepletion(1);

        vm.prank(alice); board.topUpSeat(1, 5e6); // back to ACTIVE

        simulateAndCollect(300e18); // alice earns all
        assertEq(ra.pendingForSeat(1), 300e18);
    }
}

// ════════════════════════════════════════════════════════════════════════════
// SET SEAT PRICE — grace detection
// ════════════════════════════════════════════════════════════════════════════

contract Board_v2_SetPriceTest is Board_v2_Test {
    function test_SetPrice_WhileActive_AccrualContinues() public {
        aliceTakes(1, 100e6);
        simulateAndCollect(100e18);

        vm.prank(alice); board.setSeatPrice(1, 200e6);

        assertTrue(ra.accruing(1));
        // Pending is unchanged by setSeatPrice (no banked, no hook needed)
        assertEq(ra.pendingForSeat(1), 100e18);
    }

    function test_SetPrice_TriggersGraceHookIfDepleted() public {
        aliceTakes(1, 100e6);
        simulateAndCollect(50e18);

        warpToDepletion(1); // balance hits zero; seat in GRACE

        // setSeatPrice detects GRACE via _syncGraceHook and calls onGraceEntered
        vm.prank(alice); board.setSeatPrice(1, 50e6);

        assertFalse(ra.accruing(1)); // synced to not-accruing
        assertEq(ra.activeSeatCount(), 0);
        assertGt(ra.claimable(alice), 0); // earnings banked
    }
}

// ════════════════════════════════════════════════════════════════════════════
// TAKEOVER — reward transition
// ════════════════════════════════════════════════════════════════════════════

contract Board_v2_TakeoverTest is Board_v2_Test {
    function test_TakeSeat_FromActive_OnOwnershipTransfer() public {
        aliceTakes(1, 100e6);
        simulateAndCollect(100e18); // alice earns 100

        // Bob takes seat 1 from alice
        vm.prank(bob);
        board.takeSeat(1, alice, 100e6, 80e6, minDeposit(80e6));

        // Alice's earnings banked
        assertEq(ra.claimable(alice), 100e18);
        // Bob starts accruing from current index
        assertEq(ra.pendingForSeat(1), 0);
        assertTrue(ra.accruing(1));
        assertEq(ra.activeSeatCount(), 1);
    }

    function test_TakeSeat_FromActive_BobEarnsAfterTakeover() public {
        aliceTakes(1, 100e6);
        simulateAndCollect(100e18);

        vm.prank(bob);
        board.takeSeat(1, alice, 100e6, 80e6, minDeposit(80e6));

        simulateAndCollect(200e18); // only bob accrues
        assertEq(ra.pendingForSeat(1), 200e18);
        assertEq(ra.claimable(alice), 100e18); // unchanged
    }

    function test_TakeSeat_FromGrace_OnSeatActivatedForBuyer() public {
        aliceTakes(1, 100e6);
        simulateAndCollect(50e18);
        warpToDepletion(1); // seat in GRACE

        // takeSeat syncs grace (banks alice) then calls onSeatActivated for bob
        vm.prank(bob);
        board.takeSeat(1, alice, 100e6, 80e6, minDeposit(80e6));

        assertTrue(ra.accruing(1));
        assertEq(ra.activeSeatCount(), 1);
        assertGt(ra.claimable(alice), 0); // alice banked
        assertEq(ra.pendingForSeat(1), 0); // bob starts fresh
    }

    function test_TakeSeat_ChainedTakeovers_AllEarningsRecorded() public {
        aliceTakes(1, 100e6);
        simulateAndCollect(30e18);

        vm.prank(bob);
        board.takeSeat(1, alice, 100e6, 80e6, minDeposit(80e6));
        simulateAndCollect(60e18);

        vm.prank(carol);
        board.takeSeat(1, bob, 80e6, 60e6, minDeposit(60e6));
        simulateAndCollect(90e18);

        assertEq(ra.claimable(alice), 30e18);
        assertEq(ra.claimable(bob),   60e18);
        assertEq(ra.pendingForSeat(1), 90e18); // carol's pending
    }
}

// ════════════════════════════════════════════════════════════════════════════
// FORECLOSURE — reward cleanup
// ════════════════════════════════════════════════════════════════════════════

contract Board_v2_ForecloseTest is Board_v2_Test {
    function test_Foreclose_BanksAndDeactivates() public {
        aliceTakes(1, 100e6);
        simulateAndCollect(100e18); // alice earns 100

        warpToDepletion(1);
        vm.warp(block.timestamp + GRACE_PERIOD + 1);

        board.forecloseSeat(1);

        assertFalse(ra.accruing(1));
        assertEq(ra.activeSeatCount(), 0);
        assertEq(ra.claimable(alice), 100e18);
    }

    function test_Foreclose_SeatCanBeRetaken_StartsCleanAccrual() public {
        aliceTakes(1, 100e6);
        simulateAndCollect(100e18);
        warpToDepletion(1);
        vm.warp(block.timestamp + GRACE_PERIOD + 1);
        board.forecloseSeat(1);

        // Bob takes the now-vacant seat
        vm.prank(bob); board.takeVacantSeat(1, 50e6, minDeposit(50e6));
        assertTrue(ra.accruing(1));
        assertEq(ra.pendingForSeat(1), 0); // starts fresh

        simulateAndCollect(200e18);
        assertEq(ra.pendingForSeat(1), 200e18);
    }

    function test_Foreclose_MultipleSeats_CountCorrect() public {
        aliceTakes(1, 100e6);
        vm.prank(bob); board.takeVacantSeat(2, 100e6, minDeposit(100e6));

        warpToDepletion(1);
        vm.warp(block.timestamp + GRACE_PERIOD + 1);
        board.forecloseSeat(1);

        assertEq(ra.activeSeatCount(), 1); // only seat 2 remains
        simulateAndCollect(100e18);
        assertEq(ra.pendingForSeat(2), 100e18); // seat 2 gets all
    }
}

// ════════════════════════════════════════════════════════════════════════════
// FULL VAULT FLOW
// ════════════════════════════════════════════════════════════════════════════

contract Board_v2_VaultFlowTest is Board_v2_Test {
    function test_Vault_CollectAndDeposit_DistributesToSeats() public {
        aliceTakes(1, 100e6);
        vm.prank(bob); board.takeVacantSeat(2, 100e6, minDeposit(100e6));

        vm.prank(admin); strategy.simulateYield(200e18);
        vault.collectAndDeposit();

        assertEq(ra.pendingForSeat(1), 100e18);
        assertEq(ra.pendingForSeat(2), 100e18);
    }

    function test_Vault_MultipleHarvests_Accumulate() public {
        aliceTakes(1, 100e6);

        vm.prank(admin); strategy.simulateYield(100e18);
        vault.collectAndDeposit();
        vm.prank(admin); strategy.simulateYield(200e18);
        vault.collectAndDeposit();

        assertEq(ra.pendingForSeat(1), 300e18);
    }

    function test_Vault_NothingPending_IsNoOp() public {
        aliceTakes(1, 100e6);
        uint256 before = ra.globalIndex();
        vault.collectAndDeposit(); // nothing staged
        assertEq(ra.globalIndex(), before);
    }

    function test_FullLoop_TakeEarnTakeoverClaim() public {
        // alice takes seat 1
        aliceTakes(1, 100e6);

        // strategy yields
        simulateAndCollect(300e18); // alice earns 300

        // bob takes over
        vm.prank(bob);
        board.takeSeat(1, alice, 100e6, 80e6, minDeposit(80e6));

        // more yield
        simulateAndCollect(200e18); // bob earns 200

        // alice claims
        assertEq(ra.claimable(alice), 300e18);
        vm.prank(alice); ra.claim();
        assertEq(rewardToken.balanceOf(alice), 300e18);

        // bob claims pending (must bank first via grace/takeover/foreclose)
        assertEq(ra.pendingForSeat(1), 200e18);
        // Force bank via another takeover
        vm.prank(carol);
        board.takeSeat(1, bob, 80e6, 60e6, minDeposit(60e6));
        vm.prank(bob); ra.claim();
        assertEq(rewardToken.balanceOf(bob), 200e18);
    }
}

// ════════════════════════════════════════════════════════════════════════════
// FUZZ — Board_v2 with rewards
// ════════════════════════════════════════════════════════════════════════════

contract Board_v2_FuzzTest is Board_v2_Test {
    function testFuzz_RewardsSplitCorrectly(uint256 rewardAmount, uint8 seatCount) public {
        seatCount = uint8(bound(seatCount, 1, 10));
        rewardAmount = bound(rewardAmount, uint256(seatCount), 1e30);

        address[] memory owners = new address[](seatCount);
        for (uint8 i = 0; i < seatCount; i++) {
            owners[i] = makeAddr(string(abi.encode(i + 100)));
            usdc.mint(owners[i], 1000e6);
            vm.prank(owners[i]); usdc.approve(address(board), type(uint256).max);
            vm.prank(owners[i]); board.takeVacantSeat(i + 1, 100e6, minDeposit(100e6));
        }

        simulateAndCollect(rewardAmount);

        uint256 totalPending;
        for (uint8 i = 0; i < seatCount; i++) {
            totalPending += ra.pendingForSeat(i + 1);
        }

        // Total pending ≤ deposited (rounding floor)
        assertLe(totalPending, rewardAmount);
        // At most 1 unit dust per deposit
        assertGe(totalPending, rewardAmount - uint256(seatCount));
    }
}
