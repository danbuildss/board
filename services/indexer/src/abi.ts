export const BOARD_ABI = [
  // ─── Events ───────────────────────────────────────────────────────────────
  {
    type: 'event',
    name: 'SeatAcquired',
    inputs: [
      { name: 'seatId',               type: 'uint256', indexed: true  },
      { name: 'owner',                type: 'address', indexed: true  },
      { name: 'initialPrice',         type: 'uint256', indexed: false },
      { name: 'initialHoldingDeposit',type: 'uint256', indexed: false },
      { name: 'timestamp',            type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'SeatPriceChanged',
    inputs: [
      { name: 'seatId',        type: 'uint256', indexed: true  },
      { name: 'owner',         type: 'address', indexed: true  },
      { name: 'previousPrice', type: 'uint256', indexed: false },
      { name: 'newPrice',      type: 'uint256', indexed: false },
      { name: 'timestamp',     type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'SeatTaken',
    inputs: [
      { name: 'seatId',                type: 'uint256', indexed: true  },
      { name: 'previousOwner',         type: 'address', indexed: true  },
      { name: 'newOwner',              type: 'address', indexed: true  },
      { name: 'takeoverPrice',         type: 'uint256', indexed: false },
      { name: 'newPrice',              type: 'uint256', indexed: false },
      { name: 'remainingBalanceRefund',type: 'uint256', indexed: false },
      { name: 'protocolFee',           type: 'uint256', indexed: false },
      { name: 'timestamp',             type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'SeatToppedUp',
    inputs: [
      { name: 'seatId',          type: 'uint256', indexed: true  },
      { name: 'owner',           type: 'address', indexed: true  },
      { name: 'amount',          type: 'uint256', indexed: false },
      { name: 'newPrepaidBalance',type: 'uint256', indexed: false },
      { name: 'timestamp',       type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'HoldingFeesSettled',
    inputs: [
      { name: 'seatId',           type: 'uint256', indexed: true  },
      { name: 'fee',              type: 'uint256', indexed: false },
      { name: 'elapsed',          type: 'uint256', indexed: false },
      { name: 'remainingBalance', type: 'uint256', indexed: false },
      { name: 'timestamp',        type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'SeatForeclosed',
    inputs: [
      { name: 'seatId',        type: 'uint256', indexed: true  },
      { name: 'previousOwner', type: 'address', indexed: true  },
      { name: 'timestamp',     type: 'uint256', indexed: false },
    ],
  },
  // ─── Functions (for calldata decoding) ───────────────────────────────────
  {
    type: 'function',
    name: 'takeSeat',
    inputs: [
      { name: 'seatId',         type: 'uint256' },
      { name: 'expectedOwner',  type: 'address' },
      { name: 'expectedPrice',  type: 'uint256' },
      { name: 'newPrice',       type: 'uint256' },
      { name: 'prepaidDeposit', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;
