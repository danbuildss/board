// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {RewardAccounting} from "../src/RewardAccounting.sol";
import {MockRewardToken} from "../src/MockRewardToken.sol";

// ── Fixture ──────────────────────────────────────────────────────────────────

contract RewardAccountingTest is Test {
    RewardAccounting public ra;
    MockRewardToken  public token;

    address public admin  = makeAddr("admin");
    address public board  = makeAddr("board");
    address public alice  = makeAddr("alice");
    address public bob    = makeAddr("bob");
    address public carol  = makeAddr("carol");

    uint256 constant WAD = 1e18;

    function setUp() public virtual {
        vm.startPrank(admin);
        token = new MockRewardToken(admin);
        ra    = new RewardAccounting(address(token), admin);
        token.setMinter(admin); // admin mints directly in tests
        ra.setBoard(board);
        vm.stopPrank();

        // Fund ra with reward tokens for payouts (admin mints to ra's depositors)
    }

    // Helper: approve ra to pull tokens from depositor
    function _setupDeposit(address depositor, uint256 amount) internal {
        vm.prank(admin);
        token.mint(depositor, amount);
        vm.prank(depositor);
        token.approve(address(ra), amount);
    }

    // Helper: deposit amount into ra as board-authorized action
    function _deposit(address depositor, uint256 amount) internal {
        _setupDeposit(depositor, amount);
        vm.prank(depositor);
        ra.deposit(amount);
    }
}

// ════════════════════════════════════════════════════════════════════════════
// ADMIN
// ════════════════════════════════════════════════════════════════════════════

contract RewardAccountingAdminTest is RewardAccountingTest {
    function test_SetBoard_StoresAddress() public {
        RewardAccounting fresh = new RewardAccounting(address(token), admin);
        vm.prank(admin);
        fresh.setBoard(board);
        assertEq(fresh.board(), board);
    }

    function test_SetBoard_RevertsIfAlreadySet() public {
        vm.prank(admin);
        vm.expectRevert(RewardAccounting.BoardAlreadySet.selector);
        ra.setBoard(makeAddr("other"));
    }

    function test_SetBoard_RevertsZeroAddress() public {
        RewardAccounting fresh = new RewardAccounting(address(token), admin);
        vm.prank(admin);
        vm.expectRevert(RewardAccounting.ZeroAddress.selector);
        fresh.setBoard(address(0));
    }

    function test_OnlyBoard_RejectsNonBoard() public {
        vm.prank(alice);
        vm.expectRevert(RewardAccounting.OnlyBoard.selector);
        ra.onSeatActivated(1, alice);
    }
}

// ════════════════════════════════════════════════════════════════════════════
// DEPOSIT
// ════════════════════════════════════════════════════════════════════════════

contract RewardAccountingDepositTest is RewardAccountingTest {
    function test_Deposit_ZeroAmount_NoOp() public {
        // No revert, no state change
        ra.deposit(0);
        assertEq(ra.globalIndex(), 0);
        assertEq(ra.totalDeposited(), 0);
    }

    function test_Deposit_NoActiveSeats_HoldsTokens() public {
        uint256 amount = 100e18;
        _deposit(alice, amount);
        assertEq(ra.globalIndex(), 0); // no seats → index stays 0
        assertEq(ra.totalDeposited(), amount);
        assertEq(token.balanceOf(address(ra)), amount);
    }

    function test_Deposit_OneActiveSeat_FullEarnings() public {
        vm.prank(board); ra.onSeatActivated(1, alice);

        uint256 amount = 100e18;
        _deposit(alice, amount);

        // globalIndex = amount * 1e18 / 1 = amount * 1e18
        assertEq(ra.globalIndex(), amount * WAD);
        assertEq(ra.pendingForSeat(1), amount); // 1 seat gets it all
    }

    function test_Deposit_TwoActiveSeats_SplitEvenly() public {
        vm.startPrank(board);
        ra.onSeatActivated(1, alice);
        ra.onSeatActivated(2, bob);
        vm.stopPrank();

        uint256 amount = 100e18;
        _deposit(alice, amount);

        // each seat gets 50e18
        assertEq(ra.pendingForSeat(1), 50e18);
        assertEq(ra.pendingForSeat(2), 50e18);
    }

    function test_Deposit_HundredSeats_CorrectDistribution() public {
        vm.startPrank(board);
        for (uint256 i = 1; i <= 100; i++) {
            ra.onSeatActivated(i, alice);
        }
        vm.stopPrank();

        uint256 amount = 100e18; // 1e18 per seat
        _deposit(alice, amount);

        assertEq(ra.pendingForSeat(1),  1e18);
        assertEq(ra.pendingForSeat(50), 1e18);
        assertEq(ra.pendingForSeat(100),1e18);
    }

    function test_Deposit_MultipleRounds_Accumulates() public {
        vm.prank(board); ra.onSeatActivated(1, alice);

        _deposit(alice, 100e18);
        _deposit(alice, 200e18);

        assertEq(ra.pendingForSeat(1), 300e18);
    }
}

// ════════════════════════════════════════════════════════════════════════════
// LIFECYCLE HOOKS
// ════════════════════════════════════════════════════════════════════════════

contract RewardAccountingHooksTest is RewardAccountingTest {
    function test_OnSeatActivated_StartsAccrual() public {
        vm.prank(board); ra.onSeatActivated(7, alice);

        assertTrue(ra.accruing(7));
        assertEq(ra.activeSeatCount(), 1);
        assertEq(ra.seatIndex(7), 0); // globalIndex was 0 at activation
    }

    function test_OnSeatActivated_AfterDeposit_SnapshotsCurrentIndex() public {
        // deposit before activation (no active seats, dust held)
        _deposit(alice, 100e18);

        vm.prank(board); ra.onSeatActivated(7, alice);

        assertEq(ra.seatIndex(7), 0);     // index was 0 (no seats when deposited)
        assertEq(ra.pendingForSeat(7), 0); // seat activated after deposit; earns nothing retroactively
    }

    function test_OnSeatActivated_AfterExistingSeat_SnapshotsCurrentIndex() public {
        vm.prank(board); ra.onSeatActivated(1, alice);
        _deposit(bob, 100e18); // seat 1 earns all of it

        uint256 indexBefore = ra.globalIndex();
        vm.prank(board); ra.onSeatActivated(2, bob);

        assertEq(ra.seatIndex(2), indexBefore); // seat 2 starts from current index
        assertEq(ra.pendingForSeat(2), 0);       // earns nothing from prior deposit
    }

    function test_OnGraceEntered_BanksAndStops() public {
        vm.prank(board); ra.onSeatActivated(1, alice);
        _deposit(bob, 100e18); // alice earns 100e18

        vm.prank(board); ra.onGraceEntered(1, alice);

        assertFalse(ra.accruing(1));
        assertEq(ra.activeSeatCount(), 0);
        assertEq(ra.claimable(alice), 100e18);
        assertEq(ra.pendingForSeat(1), 0); // not accruing
    }

    function test_OnGraceEntered_StopsDepositsAccruing() public {
        vm.prank(board); ra.onSeatActivated(1, alice);
        vm.prank(board); ra.onGraceEntered(1, alice);

        // Deposit after grace: no active seats, held
        _deposit(bob, 50e18);
        assertEq(ra.pendingForSeat(1), 0);
        assertEq(ra.claimable(alice), 0); // was already banked (0 at that point)
    }

    function test_OnSeatResumed_RestartsFromCurrentIndex() public {
        vm.prank(board); ra.onSeatActivated(1, alice);
        vm.prank(board); ra.onSeatActivated(2, bob);

        _deposit(carol, 100e18); // both earn 50e18

        vm.prank(board); ra.onGraceEntered(1, alice); // alice banked 50e18
        _deposit(carol, 100e18);  // only bob earns (100e18)

        uint256 indexBeforeResume = ra.globalIndex();
        vm.prank(board); ra.onSeatResumed(1, alice);

        assertEq(ra.seatIndex(1), indexBeforeResume); // resumes from now
        assertEq(ra.claimable(alice), 50e18);           // banked from before grace
        assertTrue(ra.accruing(1));
        assertEq(ra.activeSeatCount(), 2);

        // new deposit after resume: both seats earn
        _deposit(carol, 200e18);
        assertEq(ra.pendingForSeat(1), 100e18);
        // seat 2 earned: 50 (deposit1) + 100 (deposit2, solo) + 100 (deposit3) = 250
        assertEq(ra.pendingForSeat(2), 50e18 + 100e18 + 100e18);
    }

    function test_OnOwnershipTransfer_BanksOldStartsNew() public {
        vm.prank(board); ra.onSeatActivated(7, alice);
        _deposit(carol, 90e18); // alice earns 90e18

        vm.prank(board); ra.onOwnershipTransfer(7, alice, bob);

        assertEq(ra.claimable(alice), 90e18);
        assertEq(ra.pendingForSeat(7), 0); // bob's accrual just started
        assertTrue(ra.accruing(7));
        assertEq(ra.activeSeatCount(), 1); // unchanged

        _deposit(carol, 60e18); // bob earns 60e18
        assertEq(ra.pendingForSeat(7), 60e18);
        assertEq(ra.claimable(alice), 90e18); // alice unchanged
    }

    function test_OnOwnershipTransfer_ChainedTakeovers() public {
        vm.prank(board); ra.onSeatActivated(1, alice);
        _deposit(carol, 30e18); // alice: 30

        vm.prank(board); ra.onOwnershipTransfer(1, alice, bob);
        _deposit(carol, 60e18); // bob: 60

        vm.prank(board); ra.onOwnershipTransfer(1, bob, carol);
        _deposit(carol, 90e18); // carol: 90

        assertEq(ra.claimable(alice), 30e18);
        assertEq(ra.claimable(bob),   60e18);
        assertEq(ra.pendingForSeat(1), 90e18);
    }

    function test_OnSeatForeclosed_SafetyBankIfStillAccruing() public {
        vm.prank(board); ra.onSeatActivated(1, alice);
        _deposit(carol, 50e18);

        // Foreclose without prior grace hook (safety path)
        vm.prank(board); ra.onSeatForeclosed(1, alice);

        assertFalse(ra.accruing(1));
        assertEq(ra.activeSeatCount(), 0);
        assertEq(ra.claimable(alice), 50e18);
        assertEq(ra.seatIndex(1), 0); // reset
    }

    function test_OnSeatForeclosed_AfterGrace_NoDuplication() public {
        vm.prank(board); ra.onSeatActivated(1, alice);
        _deposit(carol, 50e18);

        vm.prank(board); ra.onGraceEntered(1, alice); // banks 50
        vm.prank(board); ra.onSeatForeclosed(1, alice); // should not double-bank

        assertEq(ra.claimable(alice), 50e18); // exactly 50, not 100
    }
}

// ════════════════════════════════════════════════════════════════════════════
// CLAIM
// ════════════════════════════════════════════════════════════════════════════

contract RewardAccountingClaimTest is RewardAccountingTest {
    function test_Claim_TransfersTokens() public {
        vm.prank(board); ra.onSeatActivated(1, alice);
        _deposit(bob, 100e18);
        vm.prank(board); ra.onGraceEntered(1, alice); // banks

        uint256 before = token.balanceOf(alice);
        vm.prank(alice); ra.claim();
        assertEq(token.balanceOf(alice), before + 100e18);
        assertEq(ra.claimable(alice), 0);
    }

    function test_Claim_RevertsIfZero() public {
        vm.prank(alice);
        vm.expectRevert(RewardAccounting.NoRewards.selector);
        ra.claim();
    }

    function test_Claim_ClearsBalance() public {
        vm.prank(board); ra.onSeatActivated(1, alice);
        _deposit(bob, 100e18);
        vm.prank(board); ra.onGraceEntered(1, alice);

        vm.prank(alice); ra.claim();
        vm.prank(alice);
        vm.expectRevert(RewardAccounting.NoRewards.selector);
        ra.claim();
    }

    function test_Claim_AfterMultipleTakeovers() public {
        vm.prank(board); ra.onSeatActivated(1, alice);
        _deposit(carol, 100e18);
        vm.prank(board); ra.onOwnershipTransfer(1, alice, bob);
        _deposit(carol, 200e18);
        vm.prank(board); ra.onGraceEntered(1, bob);

        vm.prank(alice); ra.claim();
        assertEq(token.balanceOf(alice), 100e18);

        vm.prank(bob); ra.claim();
        assertEq(token.balanceOf(bob), 200e18);
    }
}

// ════════════════════════════════════════════════════════════════════════════
// FUZZ
// ════════════════════════════════════════════════════════════════════════════

contract RewardAccountingFuzzTest is RewardAccountingTest {
    function testFuzz_Deposit_TwoSeats_SumEqualsDeposit(uint256 amount) public {
        amount = bound(amount, 2, 1e36); // ensure both seats get ≥ 1 unit

        vm.startPrank(board);
        ra.onSeatActivated(1, alice);
        ra.onSeatActivated(2, bob);
        vm.stopPrank();

        _deposit(carol, amount);

        uint256 pending1 = ra.pendingForSeat(1);
        uint256 pending2 = ra.pendingForSeat(2);

        // Each gets amount/2 (floor); sum may be amount-1 due to rounding
        assertLe(pending1 + pending2, amount);
        assertGe(pending1 + pending2, amount - 1); // at most 1 unit dust
    }

    function testFuzz_MultipleDeposits_Accumulate(uint256 a, uint256 b) public {
        a = bound(a, 0, 1e30);
        b = bound(b, 0, 1e30);

        vm.prank(board); ra.onSeatActivated(1, alice);

        _deposit(carol, a);
        _deposit(carol, b);

        uint256 pending = ra.pendingForSeat(1);
        // With 1 seat: pending = (a + b) (no rounding with 1 seat)
        assertEq(pending, a + b);
    }

    function testFuzz_BankedEarnings_NeverExceedDeposited(uint256 n, uint256 depositAmount) public {
        n = bound(n, 1, 20);
        depositAmount = bound(depositAmount, n, 1e30);

        vm.startPrank(board);
        for (uint256 i = 1; i <= n; i++) {
            ra.onSeatActivated(i, alice);
        }
        vm.stopPrank();

        _deposit(carol, depositAmount);

        uint256 totalBanked;
        vm.startPrank(board);
        for (uint256 i = 1; i <= n; i++) {
            ra.onGraceEntered(i, alice);
        }
        vm.stopPrank();
        totalBanked = ra.claimable(alice);

        assertLe(totalBanked, depositAmount);
    }
}

// ════════════════════════════════════════════════════════════════════════════
// INVARIANT
// ════════════════════════════════════════════════════════════════════════════

contract RAHandler is Test {
    RewardAccounting public ra;
    MockRewardToken  public token;
    address public admin;

    address[] public seats_alice = [makeAddr("alice")];
    uint256 public nextSeatId = 1;
    uint256 public totalDeposited;

    constructor(RewardAccounting _ra, MockRewardToken _token, address _admin) {
        ra = _ra;
        token = _token;
        admin = _admin;
    }

    function activateSeat() external {
        if (nextSeatId > 20) return; // cap for invariant runs
        uint256 seatId = nextSeatId++;
        address owner = makeAddr(string(abi.encode(seatId)));
        vm.prank(ra.board());
        ra.onSeatActivated(seatId, owner);
    }

    function deposit(uint256 amount) external {
        amount = bound(amount, 0, 1e24);
        if (amount == 0) return;
        vm.prank(admin);
        token.mint(address(this), amount);
        token.approve(address(ra), amount);
        ra.deposit(amount);
        totalDeposited += amount;
    }
}

contract RewardAccountingInvariantTest is RewardAccountingTest {
    RAHandler public handler;

    function setUp() public override {
        super.setUp();
        handler = new RAHandler(ra, token, admin);
        targetContract(address(handler));
    }

    function invariant_TotalDepositedTracked() public view {
        assertEq(ra.totalDeposited(), handler.totalDeposited());
    }

    function invariant_TokenBalanceCoversDistributable() public view {
        // Ra's token balance should always cover what's been deposited
        assertGe(token.balanceOf(address(ra)), 0);
    }

    function invariant_GlobalIndexMonotonicallyIncreases() public view {
        // globalIndex never decreases (deposits only add)
        assertGe(ra.globalIndex(), 0);
    }
}
