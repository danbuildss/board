export const BOARD_ABI = [
  {
    type: 'function', name: 'ownerOf', stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function', name: 'takeVacantSeat', stateMutability: 'nonpayable',
    inputs: [
      { name: 'seatId', type: 'uint256' },
      { name: 'chosenPrice', type: 'uint256' },
      { name: 'prepaidAmount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function', name: 'takeSeat', stateMutability: 'nonpayable',
    inputs: [
      { name: 'seatId', type: 'uint256' },
      { name: 'expectedOwner', type: 'address' },
      { name: 'expectedPrice', type: 'uint256' },
      { name: 'newPrice', type: 'uint256' },
      { name: 'prepaidDeposit', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function', name: 'setSeatPrice', stateMutability: 'nonpayable',
    inputs: [
      { name: 'seatId', type: 'uint256' },
      { name: 'newPrice', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function', name: 'topUpSeat', stateMutability: 'nonpayable',
    inputs: [
      { name: 'seatId', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function', name: 'forecloseSeat', stateMutability: 'nonpayable',
    inputs: [{ name: 'seatId', type: 'uint256' }],
    outputs: [],
  },
] as const

export const MOCK_STRATEGY_ABI = [
  {
    type: 'function', name: 'simulateYield', stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
] as const

export const BOARD_VAULT_ABI = [
  {
    type: 'function', name: 'collectAndDeposit', stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
] as const

export const ERC20_ABI = [
  {
    type: 'function', name: 'approve', stateMutability: 'nonpayable',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function', name: 'allowance', stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function', name: 'balanceOf', stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const
