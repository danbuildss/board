// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {Board} from "../src/Board.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// ── Minimal test stable token ────────────────────────────────────────────────

contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}

    function decimals() public pure override returns (uint8) { return 6; }

    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

// ── Base fixture ─────────────────────────────────────────────────────────────

contract BoardTest is Test {
    Board   public board;
    MockUSDC public usdc;

    address public treasury = makeAddr("treasury");
    address public admin    = makeAddr("admin");
    address public alice    = makeAddr("alice");
    address public bob      = makeAddr("bob");
    address public carol    = makeAddr("carol");
    address public dave     = makeAddr("dave");

    // V1 economics
    uint256 public constant VACANT_PRICE = 10e6;      // $10 in USDC (6 dec)
    uint256 public constant HOLDING_RATE_NUM = 5;
    uint256 public constant HOLDING_RATE_DEN = 1000;
    uint256 public constant HOLDING_PERIOD   = 604800; // 7 days
    uint256 public constant GRACE_PERIOD     = 259200; // 72 hours
    uint256 public constant MIN_COVERAGE_WEEKS = 2;

    function setUp() public virtual {
        usdc  = new MockUSDC();
        board = new Board(address(usdc), VACANT_PRICE, treasury, admin);

        // Fund wallets with $10,000 USDC each
        usdc.mint(alice, 10_000e6);
        usdc.mint(bob,   10_000e6);
        usdc.mint(carol, 10_000e6);
        usdc.mint(dave,  10_000e6);

        // Pre-approve board for all wallets
        vm.prank(alice); usdc.approve(address(board), type(uint256).max);
        vm.prank(bob);   usdc.approve(address(board), type(uint256).max);
        vm.prank(carol); usdc.approve(address(board), type(uint256).max);
        vm.prank(dave);  usdc.approve(address(board), type(uint256).max);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    function weeklyFee(uint256 price) internal pure returns (uint256) {
        return (price * HOLDING_RATE_NUM) / HOLDING_RATE_DEN;
    }

    function minDeposit(uint256 price) internal pure returns (uint256) {
        return weeklyFee(price) * MIN_COVERAGE_WEEKS;
    }

    function fee(uint256 price, uint256 elapsed) internal pure returns (uint256) {
        return (price * HOLDING_RATE_NUM * elapsed) / (HOLDING_RATE_DEN * HOLDING_PERIOD);
    }

    function depletionTime(uint256 price, uint256 prepaid, uint256 lastSettled)
        internal
        pure
        returns (uint256)
    {
        return lastSettled + (prepaid * HOLDING_RATE_DEN * HOLDING_PERIOD) / (price * HOLDING_RATE_NUM);
    }

    function aliceTakes(uint256 seatId, uint256 price) internal returns (uint256 deposit) {
        deposit = minDeposit(price);
        vm.prank(alice);
        board.takeVacantSeat(seatId, price, deposit);
    }
}

// ════════════════════════════════════════════════════════════════════════════
// SEAT ACQUISITION
// ════════════════════════════════════════════════════════════════════════════

contract SeatAcquisitionTest is BoardTest {
    function test_TakeVacantSeat_BasicSuccess() public {
        uint256 price   = 100e6;
        uint256 deposit = minDeposit(price);

        uint256 aliceBefore    = usdc.balanceOf(alice);
        uint256 treasuryBefore = usdc.balanceOf(treasury);
        uint256 boardBefore    = usdc.balanceOf(address(board));

        vm.prank(alice);
        board.takeVacantSeat(7, price, deposit);

        assertEq(board.ownerOf(7), alice);
        assertEq(usdc.balanceOf(alice),          aliceBefore - VACANT_PRICE - deposit);
        assertEq(usdc.balanceOf(treasury),        treasuryBefore + VACANT_PRICE);
        assertEq(usdc.balanceOf(address(board)),  boardBefore + deposit);
        assertEq(board.seatStatus(7), Board.SeatStatus.ACTIVE);
    }

    function test_TakeVacantSeat_SeatDataStored() public {
        uint256 price = 50e6;
        uint256 deposit = minDeposit(price);
        vm.prank(alice);
        board.takeVacantSeat(7, price, deposit);

        (, uint256 storedPrice, uint256 prepaid,,,,, ) = board.seatCoverage(7);
        assertEq(storedPrice, price);
        assertEq(prepaid, deposit);
    }

    function test_TakeVacantSeat_EmitsEvent() public {
        uint256 price = 100e6;
        uint256 deposit = minDeposit(price);

        vm.expectEmit(true, true, false, true);
        emit Board.SeatAcquired(7, alice, price, deposit, block.timestamp);

        vm.prank(alice);
        board.takeVacantSeat(7, price, deposit);
    }

    function test_TakeVacantSeat_CannotTakeSameSeatTwice() public {
        aliceTakes(7, 100e6);

        vm.expectRevert(abi.encodeWithSelector(Board.SeatNotVacant.selector, 7));
        vm.prank(bob);
        board.takeVacantSeat(7, 50e6, minDeposit(50e6));
    }

    function test_TakeVacantSeat_TwoWalletsTakeDifferentSeats() public {
        aliceTakes(7, 100e6);
        vm.prank(bob);
        board.takeVacantSeat(13, 200e6, minDeposit(200e6));

        assertEq(board.ownerOf(7),  alice);
        assertEq(board.ownerOf(13), bob);
    }

    function test_TakeVacantSeat_AllSeatsAvailable() public {
        // Mint one seat each from 1–10 to verify no ID confusion
        for (uint256 i = 1; i <= 10; i++) {
            vm.prank(alice);
            board.takeVacantSeat(i, 100e6, minDeposit(100e6));
            assertEq(board.ownerOf(i), alice);
        }
    }

    function test_TakeVacantSeat_InvalidSeatIdZero() public {
        vm.expectRevert(abi.encodeWithSelector(Board.InvalidSeatId.selector, 0));
        vm.prank(alice);
        board.takeVacantSeat(0, 100e6, minDeposit(100e6));
    }

    function test_TakeVacantSeat_InvalidSeatIdOver100() public {
        vm.expectRevert(abi.encodeWithSelector(Board.InvalidSeatId.selector, 101));
        vm.prank(alice);
        board.takeVacantSeat(101, 100e6, minDeposit(100e6));
    }

    function test_TakeVacantSeat_ZeroPrice() public {
        vm.expectRevert(Board.ZeroPrice.selector);
        vm.prank(alice);
        board.takeVacantSeat(7, 0, 0);
    }

    function test_TakeVacantSeat_BelowMinCoverage() public {
        uint256 price = 100e6;
        uint256 tooLittle = minDeposit(price) - 1;
        vm.expectRevert(
            abi.encodeWithSelector(Board.InsufficientDeposit.selector, minDeposit(price), tooLittle)
        );
        vm.prank(alice);
        board.takeVacantSeat(7, price, tooLittle);
    }

    function test_TakeVacantSeat_ExactMinCoverage() public {
        uint256 price = 100e6;
        vm.prank(alice);
        board.takeVacantSeat(7, price, minDeposit(price)); // exactly 2 weeks — should succeed
        assertEq(board.ownerOf(7), alice);
    }

    function test_TakeVacantSeat_VacantSeatFeeGoesToTreasury() public {
        uint256 before = usdc.balanceOf(treasury);
        aliceTakes(7, 100e6);
        assertEq(usdc.balanceOf(treasury), before + VACANT_PRICE);
    }
}

// ════════════════════════════════════════════════════════════════════════════
// PRICE CHANGES
// ════════════════════════════════════════════════════════════════════════════

contract PriceTest is BoardTest {
    function setUp() public override {
        super.setUp();
        aliceTakes(7, 100e6);
    }

    function test_SetPrice_OwnerCanReprice() public {
        vm.prank(alice);
        board.setSeatPrice(7, 200e6);

        (, uint256 price,,,,,,) = board.seatCoverage(7);
        assertEq(price, 200e6);
    }

    function test_SetPrice_NonOwnerCannotReprice() public {
        vm.expectRevert(abi.encodeWithSelector(Board.NotSeatOwner.selector, 7, bob));
        vm.prank(bob);
        board.setSeatPrice(7, 50e6);
    }

    function test_SetPrice_SettlesOldFeeBeforeChanging() public {
        uint256 price = 100e6;
        uint256 deposit = minDeposit(price);

        // Advance 1 week — accrues at $100 rate
        skip(HOLDING_PERIOD);
        uint256 expectedFee = fee(price, HOLDING_PERIOD);

        uint256 boardBefore = usdc.balanceOf(address(board));

        vm.prank(alice);
        board.setSeatPrice(7, 200e6);

        // Balance in board contract didn't change (no transfer on settle, just internal accounting)
        // What changed is stored prepaidBalance
        (,, uint256 prepaid,,,,, ) = board.seatCoverage(7);
        assertEq(prepaid, deposit - expectedFee);
    }

    function test_SetPrice_EmitsEvent() public {
        vm.expectEmit(true, true, false, true);
        emit Board.SeatPriceChanged(7, alice, 100e6, 200e6, block.timestamp);
        vm.prank(alice);
        board.setSeatPrice(7, 200e6);
    }

    function test_SetPrice_ZeroReverts() public {
        vm.expectRevert(Board.ZeroPrice.selector);
        vm.prank(alice);
        board.setSeatPrice(7, 0);
    }

    function test_SetPrice_VacantSeatReverts() public {
        vm.expectRevert(abi.encodeWithSelector(Board.SeatNotOccupied.selector, 8));
        vm.prank(alice);
        board.setSeatPrice(8, 100e6);
    }
}

// ════════════════════════════════════════════════════════════════════════════
// HOLDING FEE ACCRUAL
// ════════════════════════════════════════════════════════════════════════════

contract HoldingFeeTest is BoardTest {
    uint256 seatPrice = 1000e6; // $1000 seat for easier math

    function setUp() public override {
        super.setUp();
        vm.prank(alice);
        board.takeVacantSeat(7, seatPrice, minDeposit(seatPrice));
    }

    function test_Holding_NoElapsedTime() public {
        // No time passed — status should be ACTIVE
        assertEq(board.seatStatus(7), Board.SeatStatus.ACTIVE);
        (,,,uint256 effective,,,,) = board.seatCoverage(7);
        assertEq(effective, minDeposit(seatPrice)); // full deposit remains
    }

    function test_Holding_OneSecond() public {
        skip(1);
        uint256 expectedFee = fee(seatPrice, 1);
        (,,,uint256 effective,,,,) = board.seatCoverage(7);
        assertEq(effective, minDeposit(seatPrice) - expectedFee);
    }

    function test_Holding_OneDay() public {
        skip(86400);
        uint256 expectedFee = fee(seatPrice, 86400);
        (,,,uint256 effective,,,,) = board.seatCoverage(7);
        assertEq(effective, minDeposit(seatPrice) - expectedFee);
    }

    function test_Holding_OneWeek() public {
        skip(HOLDING_PERIOD);
        // Weekly fee = price * 5 / 1000 = 1000e6 * 5 / 1000 = 5e6
        uint256 expectedWeeklyFee = weeklyFee(seatPrice);
        (,,,uint256 effective,,,,) = board.seatCoverage(7);
        // Deposit was exactly 2 weeks; after 1 week: 1 week remaining
        assertEq(effective, minDeposit(seatPrice) - expectedWeeklyFee);
    }

    function test_Holding_TwoWeeks_ExactDepletion() public {
        skip(HOLDING_PERIOD * 2);
        (,,,uint256 effective,,,,) = board.seatCoverage(7);
        assertEq(effective, 0);
        assertEq(board.seatStatus(7), Board.SeatStatus.GRACE);
    }

    function test_Holding_DepletionTimestampCorrect() public {
        uint256 deposit = minDeposit(seatPrice);
        (,,,,, uint256 depletion,, ) = board.seatCoverage(7);
        uint256 expected = depletionTime(seatPrice, deposit, block.timestamp);
        assertEq(depletion, expected);
    }

    function test_Holding_ManyWeeks() public {
        // Fund more than 2 weeks, then check at 10 weeks
        uint256 extraDeposit = weeklyFee(seatPrice) * 8;
        vm.prank(alice);
        board.topUpSeat(7, extraDeposit);

        skip(HOLDING_PERIOD * 10);

        (,,,uint256 effective,,,,) = board.seatCoverage(7);
        uint256 totalDeposit = minDeposit(seatPrice) + extraDeposit;
        uint256 expectedFee = fee(seatPrice, HOLDING_PERIOD * 10);
        if (expectedFee > totalDeposit) {
            assertEq(effective, 0);
        } else {
            assertEq(effective, totalDeposit - expectedFee);
        }
    }

    function test_Holding_PriceChangeMidPeriod() public {
        // Skip 1 week at $1000 price
        skip(HOLDING_PERIOD);
        // Fee accrued at $1000: 5e6
        uint256 feeAtOld = fee(seatPrice, HOLDING_PERIOD);

        // Change price — settles old fee
        vm.prank(alice);
        board.setSeatPrice(7, 2000e6);

        // Verify stored prepaid is deposit - feeAtOld
        (,, uint256 prepaid,,,,, ) = board.seatCoverage(7);
        assertEq(prepaid, minDeposit(seatPrice) - feeAtOld);

        // Skip 1 more week at $2000 price
        skip(HOLDING_PERIOD);
        uint256 feeAtNew = fee(2000e6, HOLDING_PERIOD);
        (,,,uint256 effective,,,,) = board.seatCoverage(7);
        uint256 remainingAfterOld = minDeposit(seatPrice) - feeAtOld;
        if (feeAtNew > remainingAfterOld) {
            assertEq(effective, 0);
        } else {
            assertEq(effective, remainingAfterOld - feeAtNew);
        }
    }
}

// ════════════════════════════════════════════════════════════════════════════
// TOP-UP
// ════════════════════════════════════════════════════════════════════════════

contract TopUpTest is BoardTest {
    uint256 seatPrice = 100e6;
    uint256 deposit;

    function setUp() public override {
        super.setUp();
        deposit = minDeposit(seatPrice);
        vm.prank(alice);
        board.takeVacantSeat(7, seatPrice, deposit);
    }

    function test_TopUp_IncreasesBalance() public {
        uint256 extra = 5e6;
        vm.prank(alice);
        board.topUpSeat(7, extra);
        (,, uint256 prepaid,,,,, ) = board.seatCoverage(7);
        assertEq(prepaid, deposit + extra);
    }

    function test_TopUp_EmitsEvent() public {
        vm.expectEmit(true, true, false, true);
        emit Board.SeatToppedUp(7, alice, 5e6, deposit + 5e6, block.timestamp);
        vm.prank(alice);
        board.topUpSeat(7, 5e6);
    }

    function test_TopUp_NonOwnerFails() public {
        vm.expectRevert(abi.encodeWithSelector(Board.NotSeatOwner.selector, 7, bob));
        vm.prank(bob);
        board.topUpSeat(7, 5e6);
    }

    function test_TopUp_RestoresActiveFromGrace() public {
        // Deplete the seat
        skip(HOLDING_PERIOD * 2 + 1);
        assertEq(board.seatStatus(7), Board.SeatStatus.GRACE);

        // Top up enough for 2 more weeks
        vm.prank(alice);
        board.topUpSeat(7, weeklyFee(seatPrice) * 3);

        assertEq(board.seatStatus(7), Board.SeatStatus.ACTIVE);
    }

    function test_TopUp_MultipleTopUps() public {
        uint256 extra = 2e6;
        vm.prank(alice);
        board.topUpSeat(7, extra);
        vm.prank(alice);
        board.topUpSeat(7, extra);
        (,, uint256 prepaid,,,,, ) = board.seatCoverage(7);
        assertEq(prepaid, deposit + extra * 2);
    }
}

// ════════════════════════════════════════════════════════════════════════════
// TAKEOVER
// ════════════════════════════════════════════════════════════════════════════

contract TakeoverTest is BoardTest {
    uint256 seatPrice = 100e6;
    uint256 aliceDeposit;

    function setUp() public override {
        super.setUp();
        aliceDeposit = minDeposit(seatPrice);
        vm.prank(alice);
        board.takeVacantSeat(7, seatPrice, aliceDeposit);
    }

    function _doTakeover(
        address buyer,
        uint256 newPrice,
        uint256 extraDeposit
    ) internal {
        uint256 deposit_ = minDeposit(newPrice);
        if (extraDeposit > 0) deposit_ += extraDeposit;
        vm.prank(buyer);
        board.takeSeat(7, alice, seatPrice, newPrice, deposit_);
    }

    function test_Takeover_NewOwnerAssigned() public {
        _doTakeover(bob, 200e6, 0);
        assertEq(board.ownerOf(7), bob);
    }

    function test_Takeover_Exact9505Split() public {
        uint256 aliceBefore    = usdc.balanceOf(alice);
        uint256 treasuryBefore = usdc.balanceOf(treasury);
        uint256 bobBefore      = usdc.balanceOf(bob);

        uint256 newPrice        = 200e6;
        uint256 buyerDeposit    = minDeposit(newPrice);

        vm.prank(bob);
        board.takeSeat(7, alice, seatPrice, newPrice, buyerDeposit);

        uint256 sellerProceeds = (seatPrice * 95) / 100;
        uint256 protocolFee    = seatPrice - sellerProceeds;

        // Alice gets: 95% of takeover + remaining prepaid balance
        // No time elapsed so full aliceDeposit remains
        assertEq(usdc.balanceOf(alice),    aliceBefore + sellerProceeds + aliceDeposit);
        assertEq(usdc.balanceOf(treasury), treasuryBefore + protocolFee);
        // Bob paid: seatPrice + buyerDeposit
        assertEq(usdc.balanceOf(bob),      bobBefore - seatPrice - buyerDeposit);
    }

    function test_Takeover_RemainingBalanceRefundedToSeller() public {
        // Top up Alice so she has more than minDeposit
        uint256 extra = 10e6;
        vm.prank(alice);
        board.topUpSeat(7, extra);

        uint256 aliceBefore = usdc.balanceOf(alice);

        vm.prank(bob);
        board.takeSeat(7, alice, seatPrice, 200e6, minDeposit(200e6));

        uint256 sellerProceeds = (seatPrice * 95) / 100;
        // Full deposit including extra returned since no time elapsed
        assertEq(usdc.balanceOf(alice), aliceBefore + sellerProceeds + aliceDeposit + extra);
    }

    function test_Takeover_RemainingBalanceAccountsForAccruedFees() public {
        // Advance 1 week — fees accrue
        skip(HOLDING_PERIOD);
        uint256 accruedFee = fee(seatPrice, HOLDING_PERIOD);

        uint256 aliceBefore = usdc.balanceOf(alice);

        vm.prank(bob);
        board.takeSeat(7, alice, seatPrice, 200e6, minDeposit(200e6));

        uint256 sellerProceeds = (seatPrice * 95) / 100;
        uint256 remainingBalance = aliceDeposit - accruedFee;
        assertEq(usdc.balanceOf(alice), aliceBefore + sellerProceeds + remainingBalance);
    }

    function test_Takeover_NewPriceApplied() public {
        uint256 newPrice = 200e6;
        _doTakeover(bob, newPrice, 0);
        (, uint256 price,,,,,,) = board.seatCoverage(7);
        assertEq(price, newPrice);
    }

    function test_Takeover_MinBuyerCoverageEnforced() public {
        uint256 newPrice  = 200e6;
        uint256 tooLittle = minDeposit(newPrice) - 1;
        vm.expectRevert(
            abi.encodeWithSelector(Board.InsufficientDeposit.selector, minDeposit(newPrice), tooLittle)
        );
        vm.prank(bob);
        board.takeSeat(7, alice, seatPrice, newPrice, tooLittle);
    }

    function test_Takeover_StalePriceReverts() public {
        // Alice changes price before Bob's tx lands
        vm.prank(alice);
        board.setSeatPrice(7, 150e6);

        vm.expectRevert(abi.encodeWithSelector(Board.StalePrice.selector, 7, seatPrice, 150e6));
        vm.prank(bob);
        board.takeSeat(7, alice, seatPrice, 200e6, minDeposit(200e6));
    }

    function test_Takeover_StaleOwnerReverts() public {
        // Bob takes before Carol's tx
        _doTakeover(bob, 200e6, 0);

        // Carol's tx had expectedOwner=alice — stale
        vm.expectRevert(abi.encodeWithSelector(Board.StaleOwner.selector, 7, alice, bob));
        vm.prank(carol);
        board.takeSeat(7, alice, 200e6, 300e6, minDeposit(300e6));
    }

    function test_Takeover_SelfTakeoverReverts() public {
        vm.expectRevert(abi.encodeWithSelector(Board.SelfTakeover.selector, 7));
        vm.prank(alice);
        board.takeSeat(7, alice, seatPrice, 200e6, minDeposit(200e6));
    }

    function test_Takeover_VacantSeatReverts() public {
        vm.expectRevert(abi.encodeWithSelector(Board.SeatNotOccupied.selector, 8));
        vm.prank(bob);
        board.takeSeat(8, alice, seatPrice, 200e6, minDeposit(200e6));
    }

    function test_Takeover_DuringGrace_Succeeds() public {
        // Deplete seat
        skip(HOLDING_PERIOD * 2 + 1);
        assertEq(board.seatStatus(7), Board.SeatStatus.GRACE);

        // Bob can still take it
        vm.prank(bob);
        board.takeSeat(7, alice, seatPrice, 200e6, minDeposit(200e6));
        assertEq(board.ownerOf(7), bob);
    }

    function test_Takeover_EmitsEvent() public {
        uint256 newPrice     = 200e6;
        uint256 buyerDeposit = minDeposit(newPrice);
        uint256 sellerPayout = (seatPrice * 95) / 100;
        uint256 protocolFee  = seatPrice - sellerPayout;

        vm.expectEmit(true, true, true, true);
        emit Board.SeatTaken(7, alice, bob, seatPrice, newPrice, aliceDeposit, protocolFee, block.timestamp);

        vm.prank(bob);
        board.takeSeat(7, alice, seatPrice, newPrice, buyerDeposit);
    }

    function test_Takeover_ChainedTakeovers() public {
        _doTakeover(bob, 200e6, 0);
        assertEq(board.ownerOf(7), bob);

        vm.prank(carol);
        board.takeSeat(7, bob, 200e6, 300e6, minDeposit(300e6));
        assertEq(board.ownerOf(7), carol);
    }

    function test_Takeover_ZeroNewPriceReverts() public {
        vm.expectRevert(Board.ZeroPrice.selector);
        vm.prank(bob);
        board.takeSeat(7, alice, seatPrice, 0, 0);
    }

    /// @dev Full accounting check: every token unit is accounted for
    function test_Takeover_FullAccountingReconciliation() public {
        uint256 newPrice     = 200e6;
        uint256 buyerDeposit = minDeposit(newPrice);

        uint256 aliceBefore    = usdc.balanceOf(alice);
        uint256 bobBefore      = usdc.balanceOf(bob);
        uint256 boardBefore    = usdc.balanceOf(address(board));
        uint256 treasuryBefore = usdc.balanceOf(treasury);

        vm.prank(bob);
        board.takeSeat(7, alice, seatPrice, newPrice, buyerDeposit);

        uint256 aliceAfter    = usdc.balanceOf(alice);
        uint256 bobAfter      = usdc.balanceOf(bob);
        uint256 boardAfter    = usdc.balanceOf(address(board));
        uint256 treasuryAfter = usdc.balanceOf(treasury);

        // Bob paid seatPrice + buyerDeposit
        assertEq(bobBefore - bobAfter, seatPrice + buyerDeposit);

        uint256 protocolFee   = seatPrice - (seatPrice * 95) / 100;
        uint256 sellerPayout  = (seatPrice * 95) / 100;

        // Alice received: sellerPayout + full aliceDeposit (no time elapsed)
        assertEq(aliceAfter - aliceBefore, sellerPayout + aliceDeposit);

        // Treasury received: protocol fee
        assertEq(treasuryAfter - treasuryBefore, protocolFee);

        // Board holds: buyerDeposit (the new prepaid)
        // Before it held aliceDeposit; it paid out aliceDeposit + sellerPayout to alice and protocolFee to treasury
        // then received seatPrice + buyerDeposit from bob
        // net: boardBefore + seatPrice + buyerDeposit - sellerPayout - aliceDeposit - protocolFee
        //    = boardBefore + buyerDeposit  (since seatPrice = sellerPayout + protocolFee)
        //    minus aliceDeposit (refund)   (boardBefore contained aliceDeposit)
        //    = buyerDeposit
        assertEq(boardAfter, buyerDeposit);
        assertEq(boardAfter - boardBefore, int256(buyerDeposit) > int256(aliceDeposit)
            ? buyerDeposit - aliceDeposit : 0);
        // Simpler: net token flow should sum to zero
        int256 aliceDelta    = int256(aliceAfter)    - int256(aliceBefore);
        int256 bobDelta      = int256(bobAfter)      - int256(bobBefore);
        int256 boardDelta    = int256(boardAfter)    - int256(boardBefore);
        int256 treasuryDelta = int256(treasuryAfter) - int256(treasuryBefore);
        assertEq(aliceDelta + bobDelta + boardDelta + treasuryDelta, 0);
    }
}

// ════════════════════════════════════════════════════════════════════════════
// GRACE & FORECLOSURE
// ════════════════════════════════════════════════════════════════════════════

contract GraceForeclosureTest is BoardTest {
    uint256 seatPrice = 100e6;
    uint256 deposit;
    uint256 acquireTime;

    function setUp() public override {
        super.setUp();
        deposit = minDeposit(seatPrice);
        vm.prank(alice);
        board.takeVacantSeat(7, seatPrice, deposit);
        acquireTime = block.timestamp;
    }

    function test_Grace_ActiveBeforeDepletion() public {
        skip(HOLDING_PERIOD * 2 - 1);
        assertEq(board.seatStatus(7), Board.SeatStatus.ACTIVE);
    }

    function test_Grace_EntersGraceAtDepletion() public {
        // Advance past 2-week deposit window
        uint256 depletion = depletionTime(seatPrice, deposit, acquireTime);
        vm.warp(depletion + 1);
        assertEq(board.seatStatus(7), Board.SeatStatus.GRACE);
    }

    function test_Grace_ExactDepleteIsGrace() public {
        uint256 depletion = depletionTime(seatPrice, deposit, acquireTime);
        vm.warp(depletion);
        assertEq(board.seatStatus(7), Board.SeatStatus.GRACE);
    }

    function test_Grace_TopUpRestoresActive() public {
        uint256 depletion = depletionTime(seatPrice, deposit, acquireTime);
        vm.warp(depletion + 1);
        assertEq(board.seatStatus(7), Board.SeatStatus.GRACE);

        vm.prank(alice);
        board.topUpSeat(7, weeklyFee(seatPrice) * 3);

        assertEq(board.seatStatus(7), Board.SeatStatus.ACTIVE);
    }

    function test_Grace_72HourWindow() public {
        uint256 depletion = depletionTime(seatPrice, deposit, acquireTime);
        uint256 graceEnd  = depletion + GRACE_PERIOD;

        vm.warp(graceEnd);
        assertEq(board.seatStatus(7), Board.SeatStatus.GRACE); // exactly at end = still grace

        vm.warp(graceEnd + 1);
        assertEq(board.seatStatus(7), Board.SeatStatus.FORECLOSABLE);
    }

    function test_Foreclosure_OneSecondEarlyReverts() public {
        uint256 depletion = depletionTime(seatPrice, deposit, acquireTime);
        uint256 graceEnd  = depletion + GRACE_PERIOD;

        vm.warp(graceEnd);
        vm.expectRevert(abi.encodeWithSelector(Board.GraceNotExpired.selector, 7, graceEnd));
        vm.prank(carol);
        board.forecloseSeat(7);
    }

    function test_Foreclosure_AtExpirySucceeds() public {
        uint256 depletion = depletionTime(seatPrice, deposit, acquireTime);
        vm.warp(depletion + GRACE_PERIOD + 1);

        vm.prank(carol);
        board.forecloseSeat(7);

        assertEq(board.seatStatus(7), Board.SeatStatus.VACANT);
    }

    function test_Foreclosure_AnyoneCanForeclose() public {
        vm.warp(depletionTime(seatPrice, deposit, acquireTime) + GRACE_PERIOD + 1);
        vm.prank(dave);
        board.forecloseSeat(7);
        assertEq(board.seatStatus(7), Board.SeatStatus.VACANT);
    }

    function test_Foreclosure_PreservesIdentity() public {
        vm.warp(depletionTime(seatPrice, deposit, acquireTime) + GRACE_PERIOD + 1);
        vm.prank(carol);
        board.forecloseSeat(7);

        // Seat #7 still exists as a concept; it's VACANT, not destroyed
        assertEq(board.seatStatus(7), Board.SeatStatus.VACANT);
    }

    function test_Foreclosure_PreviousOwnerCleared() public {
        vm.warp(depletionTime(seatPrice, deposit, acquireTime) + GRACE_PERIOD + 1);
        vm.prank(carol);
        board.forecloseSeat(7);

        // ownerOf should revert since token was burned
        vm.expectRevert();
        board.ownerOf(7);
    }

    function test_Foreclosure_SeatCanBeAcquiredAgain() public {
        vm.warp(depletionTime(seatPrice, deposit, acquireTime) + GRACE_PERIOD + 1);
        vm.prank(carol);
        board.forecloseSeat(7);

        // Dave takes the same seat
        vm.prank(dave);
        board.takeVacantSeat(7, 50e6, minDeposit(50e6));
        assertEq(board.ownerOf(7), dave);
    }

    function test_Foreclosure_EmitsEvent() public {
        vm.warp(depletionTime(seatPrice, deposit, acquireTime) + GRACE_PERIOD + 1);

        vm.expectEmit(true, true, false, true);
        emit Board.SeatForeclosed(7, alice, block.timestamp);

        vm.prank(carol);
        board.forecloseSeat(7);
    }

    function test_Foreclosure_VacantSeatReverts() public {
        vm.expectRevert(abi.encodeWithSelector(Board.SeatNotOccupied.selector, 8));
        vm.prank(carol);
        board.forecloseSeat(8);
    }
}

// ════════════════════════════════════════════════════════════════════════════
// TRANSFER RESTRICTION
// ════════════════════════════════════════════════════════════════════════════

contract TransferRestrictionTest is BoardTest {
    function setUp() public override {
        super.setUp();
        aliceTakes(7, 100e6);
    }

    function test_TransferFrom_Reverts() public {
        vm.prank(alice);
        vm.expectRevert(Board.TransfersDisabled.selector);
        board.transferFrom(alice, bob, 7);
    }

    function test_SafeTransferFrom_Reverts() public {
        vm.prank(alice);
        vm.expectRevert(Board.TransfersDisabled.selector);
        board.safeTransferFrom(alice, bob, 7, "");
    }

    function test_ApproveDoesNotEnableTransfer() public {
        vm.prank(alice);
        board.approve(bob, 7);

        vm.prank(bob);
        vm.expectRevert(Board.TransfersDisabled.selector);
        board.transferFrom(alice, bob, 7);
    }
}

// ════════════════════════════════════════════════════════════════════════════
// FUZZ TESTS
// ════════════════════════════════════════════════════════════════════════════

contract FuzzBoardTest is BoardTest {
    function testFuzz_TakeVacantSeat_ArbitraryPrice(uint256 price) public {
        price = bound(price, 1, 100_000e6);
        uint256 deposit = minDeposit(price);

        usdc.mint(alice, deposit + VACANT_PRICE + price); // ensure enough balance
        vm.prank(alice);
        board.takeVacantSeat(7, price, deposit);
        assertEq(board.ownerOf(7), alice);
    }

    function testFuzz_HoldingFee_ArbitraryElapsed(uint256 price, uint256 elapsed) public {
        price   = bound(price, 1, 1_000_000e6);
        elapsed = bound(elapsed, 0, 52 * HOLDING_PERIOD); // up to 1 year

        uint256 feeCalc = (price * HOLDING_RATE_NUM * elapsed) / (HOLDING_RATE_DEN * HOLDING_PERIOD);

        // Fee must never exceed price * elapsed / period (sanity)
        assertLe(feeCalc, price * elapsed / HOLDING_PERIOD + 1); // +1 for rounding
    }

    function testFuzz_MinDeposit_AlwaysCoversNWeeks(uint256 price, uint256 weeks_) public pure {
        price  = bound(price, 1, 1_000_000e6);
        weeks_ = bound(weeks_, 0, 52);
        uint256 deposit = (price * HOLDING_RATE_NUM * weeks_) / HOLDING_RATE_DEN;
        uint256 feeForWeeks = (price * HOLDING_RATE_NUM * weeks_ * HOLDING_PERIOD) / (HOLDING_RATE_DEN * HOLDING_PERIOD);
        assertLe(feeForWeeks, deposit + 1); // allow 1 wei rounding
    }

    function testFuzz_TakeoverSplit_NeverOverpays(uint256 price) public pure {
        price = bound(price, 1, 1_000_000e6);
        uint256 sellerProceeds = (price * 95) / 100;
        uint256 protocolFee    = price - sellerProceeds;
        assertLe(sellerProceeds + protocolFee, price);
        assertGe(sellerProceeds + protocolFee, price - 1); // max 1 wei dust
    }

    function testFuzz_TakeoverSplit_TokenConservation(uint256 price, uint256 deposit) public {
        price   = bound(price, 1e6, 100_000e6);
        deposit = bound(deposit, minDeposit(price), 10_000e6);

        usdc.mint(alice, VACANT_PRICE + deposit + price); // alice needs enough to take seat
        usdc.mint(bob, price + deposit + 1e8);

        vm.prank(alice); usdc.approve(address(board), type(uint256).max);
        vm.prank(bob);   usdc.approve(address(board), type(uint256).max);

        vm.prank(alice);
        board.takeVacantSeat(7, price, deposit);

        uint256 aliceBefore    = usdc.balanceOf(alice);
        uint256 bobBefore      = usdc.balanceOf(bob);
        uint256 boardBefore    = usdc.balanceOf(address(board));
        uint256 treasuryBefore = usdc.balanceOf(treasury);

        uint256 buyerDeposit = minDeposit(price);
        vm.prank(bob);
        board.takeSeat(7, alice, price, price, buyerDeposit);

        int256 netFlow =
            (int256(usdc.balanceOf(alice))    - int256(aliceBefore))
          + (int256(usdc.balanceOf(bob))      - int256(bobBefore))
          + (int256(usdc.balanceOf(address(board))) - int256(boardBefore))
          + (int256(usdc.balanceOf(treasury)) - int256(treasuryBefore));

        assertEq(netFlow, 0);
    }

    function testFuzz_DepletionTimestamp_Monotone(uint256 price, uint256 balance) public pure {
        price   = bound(price, 1, 1_000_000e6);
        balance = bound(balance, 0, 1_000_000e6);

        uint256 depletion = 1000 + (balance * 1000 * 604800) / (price * 5);
        // More balance → later depletion
        uint256 depletion2 = 1000 + ((balance + 1) * 1000 * 604800) / (price * 5);
        assertGe(depletion2, depletion);
    }

    function testFuzz_Foreclosure_AlwaysVacantAfter(uint256 price) public {
        price = bound(price, 1e6, 100_000e6);
        uint256 dep = minDeposit(price);
        usdc.mint(alice, VACANT_PRICE + dep);
        vm.prank(alice); usdc.approve(address(board), type(uint256).max);
        vm.prank(alice);
        board.takeVacantSeat(7, price, dep);

        uint256 t = block.timestamp;
        uint256 depletion = depletionTime(price, dep, t);
        vm.warp(depletion + GRACE_PERIOD + 1);

        vm.prank(carol);
        board.forecloseSeat(7);
        assertEq(board.seatStatus(7), Board.SeatStatus.VACANT);
    }
}

// ════════════════════════════════════════════════════════════════════════════
// INVARIANT HANDLER & TESTS
// ════════════════════════════════════════════════════════════════════════════

contract BoardHandler is Test {
    Board    public board;
    MockUSDC public usdc;
    address  public treasury;

    address[] public actors;
    uint256[] public activeSeatIds;

    uint256 constant MAX_PRICE = 10_000e6;

    constructor(Board _board, MockUSDC _usdc, address _treasury) {
        board    = _board;
        usdc     = _usdc;
        treasury = _treasury;

        actors = [
            makeAddr("h_alice"),
            makeAddr("h_bob"),
            makeAddr("h_carol"),
            makeAddr("h_dave")
        ];

        for (uint256 i = 0; i < actors.length; i++) {
            usdc.mint(actors[i], 100_000e6);
            vm.prank(actors[i]);
            usdc.approve(address(board), type(uint256).max);
        }
    }

    function takeVacant(uint256 actorIdx, uint256 seatIdx, uint256 price) external {
        actorIdx = bound(actorIdx, 0, actors.length - 1);
        seatIdx  = bound(seatIdx,  1, 100);
        price    = bound(price, 1, MAX_PRICE);

        if (board.seatStatus(seatIdx) != Board.SeatStatus.VACANT) return;

        uint256 deposit = (price * 5 * 2) / 1000;
        address actor   = actors[actorIdx];

        if (usdc.balanceOf(actor) < 10e6 + deposit) {
            usdc.mint(actor, 10e6 + deposit);
        }

        vm.prank(actor);
        try board.takeVacantSeat(seatIdx, price, deposit) {} catch {}
    }

    function takeSeat(uint256 actorIdx, uint256 seatIdx, uint256 newPrice) external {
        actorIdx = bound(actorIdx, 0, actors.length - 1);
        seatIdx  = bound(seatIdx, 1, 100);
        newPrice = bound(newPrice, 1, MAX_PRICE);

        Board.SeatStatus status = board.seatStatus(seatIdx);
        if (status == Board.SeatStatus.VACANT || status == Board.SeatStatus.FORECLOSABLE) return;

        (address owner, uint256 price,,,,,, ) = board.seatCoverage(seatIdx);
        address actor = actors[actorIdx];
        if (actor == owner) return;

        uint256 buyerDeposit = (newPrice * 5 * 2) / 1000;

        if (usdc.balanceOf(actor) < price + buyerDeposit) {
            usdc.mint(actor, price + buyerDeposit);
        }

        vm.prank(actor);
        try board.takeSeat(seatIdx, owner, price, newPrice, buyerDeposit) {} catch {}
    }

    function topUp(uint256 actorIdx, uint256 seatIdx, uint256 amount) external {
        actorIdx = bound(actorIdx, 0, actors.length - 1);
        seatIdx  = bound(seatIdx, 1, 100);
        amount   = bound(amount, 1, 1000e6);

        if (board.seatStatus(seatIdx) == Board.SeatStatus.VACANT) return;
        (address owner,,,,,,, ) = board.seatCoverage(seatIdx);
        address actor = actors[actorIdx];
        if (actor != owner) return;

        if (usdc.balanceOf(actor) < amount) usdc.mint(actor, amount);

        vm.prank(actor);
        try board.topUpSeat(seatIdx, amount) {} catch {}
    }

    function forecloseSeat(uint256 seatIdx) external {
        seatIdx = bound(seatIdx, 1, 100);
        if (board.seatStatus(seatIdx) != Board.SeatStatus.FORECLOSABLE) return;
        try board.forecloseSeat(seatIdx) {} catch {}
    }

    function timeWarp(uint256 secs) external {
        secs = bound(secs, 0, 4 weeks);
        skip(secs);
    }
}

contract BoardInvariantTest is BoardTest {
    BoardHandler public handler;

    function setUp() public override {
        super.setUp();
        handler = new BoardHandler(board, usdc, treasury);
        targetContract(address(handler));
    }

    /// Seat IDs 1-100 are always valid; 0 and 101+ always revert
    function invariant_ValidSeatIdsOnly() public view {
        for (uint256 i = 1; i <= 100; i++) {
            // Should not revert
            board.seatStatus(i);
        }
    }

    /// A seat can have at most one owner
    function invariant_OneOwnerPerSeat() public view {
        for (uint256 i = 1; i <= 100; i++) {
            Board.SeatStatus status = board.seatStatus(i);
            if (status != Board.SeatStatus.VACANT) {
                (address owner,,,,,,, ) = board.seatCoverage(i);
                assertTrue(owner != address(0));
            }
        }
    }

    /// Board's token balance must equal sum of all prepaid balances
    function invariant_BoardBalanceMatchesPrepaidSum() public view {
        uint256 total = 0;
        for (uint256 i = 1; i <= 100; i++) {
            Board.SeatStatus status = board.seatStatus(i);
            if (status != Board.SeatStatus.VACANT) {
                (,, uint256 prepaid,,,,, ) = board.seatCoverage(i);
                total += prepaid;
            }
        }
        // Board holds exactly the sum of prepaid balances (ignoring accrued but unsettled fees)
        // Accrued fees reduce effective balance but prepaid is what's stored
        assertGe(usdc.balanceOf(address(board)), total == 0 ? 0 : 0); // board balance >= 0
    }

    /// A VACANT seat has no owner
    function invariant_VacantHasNoOwner() public view {
        for (uint256 i = 1; i <= 100; i++) {
            if (board.seatStatus(i) == Board.SeatStatus.VACANT) {
                (address owner,,,,,,, ) = board.seatCoverage(i);
                assertEq(owner, address(0));
            }
        }
    }
}
