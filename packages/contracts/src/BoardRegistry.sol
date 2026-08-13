// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Onchain configuration store for BOARD instances.
///         The registry is a discovery and config layer only —
///         it does not hold funds or control lifecycle mechanics.
///         BoardCore (Board_v2) is the authoritative runtime contract per board.
contract BoardRegistry is Ownable {
    // ─── Types ────────────────────────────────────────────────────────────────

    enum BoardStatus {
        PENDING,
        ACTIVE,
        PAUSED,
        DEPRECATED
    }

    struct BoardConfig {
        uint256 boardId;
        string name;
        string marketSymbol;
        uint256 seatCount;
        address settlementAsset;
        address rewardAsset;
        address strategyAdapter;
        address boardCore;
        uint256 vacantPrice;
        uint256 holdingRateBps;  // basis points per week (50 = 0.5%)
        uint256 gracePeriod;     // seconds (259200 = 72h)
        BoardStatus status;
    }

    // ─── State ────────────────────────────────────────────────────────────────

    uint256 public boardCount;
    mapping(uint256 => BoardConfig) private _boards;

    // ─── Errors ───────────────────────────────────────────────────────────────

    error BoardNotFound(uint256 boardId);
    error ZeroAddress();
    error InvalidSeatCount();
    error InvalidHoldingRate();

    // ─── Events ───────────────────────────────────────────────────────────────

    event BoardRegistered(uint256 indexed boardId, string name, address indexed boardCore);
    event BoardStatusUpdated(uint256 indexed boardId, BoardStatus status);
    event BoardStrategyUpdated(uint256 indexed boardId, address strategyAdapter);

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(address _admin) Ownable(_admin) {}

    // ─── Admin ────────────────────────────────────────────────────────────────

    /// @notice Register a new Board. Returns its boardId (starts at 1).
    function registerBoard(
        string calldata name,
        string calldata marketSymbol,
        uint256 seatCount,
        address settlementAsset,
        address rewardAsset,
        address strategyAdapter,
        address boardCore,
        uint256 vacantPrice,
        uint256 holdingRateBps,
        uint256 gracePeriod
    ) external onlyOwner returns (uint256 boardId) {
        if (settlementAsset == address(0)) revert ZeroAddress();
        if (boardCore == address(0)) revert ZeroAddress();
        if (seatCount == 0) revert InvalidSeatCount();
        if (holdingRateBps == 0 || holdingRateBps > 10_000) revert InvalidHoldingRate();

        boardId = ++boardCount;
        _boards[boardId] = BoardConfig({
            boardId: boardId,
            name: name,
            marketSymbol: marketSymbol,
            seatCount: seatCount,
            settlementAsset: settlementAsset,
            rewardAsset: rewardAsset,
            strategyAdapter: strategyAdapter,
            boardCore: boardCore,
            vacantPrice: vacantPrice,
            holdingRateBps: holdingRateBps,
            gracePeriod: gracePeriod,
            status: BoardStatus.PENDING
        });

        emit BoardRegistered(boardId, name, boardCore);
    }

    /// @notice Update board status (PENDING → ACTIVE → PAUSED / DEPRECATED).
    function setStatus(uint256 boardId, BoardStatus status) external onlyOwner {
        _requireExists(boardId);
        _boards[boardId].status = status;
        emit BoardStatusUpdated(boardId, status);
    }

    /// @notice Update the strategy adapter address (e.g. upgrade to real adapter).
    function setStrategyAdapter(uint256 boardId, address strategyAdapter) external onlyOwner {
        _requireExists(boardId);
        _boards[boardId].strategyAdapter = strategyAdapter;
        emit BoardStrategyUpdated(boardId, strategyAdapter);
    }

    // ─── Views ────────────────────────────────────────────────────────────────

    /// @notice Get full config for a board. Reverts if not registered.
    function getBoard(uint256 boardId) external view returns (BoardConfig memory) {
        _requireExists(boardId);
        return _boards[boardId];
    }

    /// @notice Returns all boards with ACTIVE status.
    function getActiveBoards() external view returns (BoardConfig[] memory result) {
        uint256 active = 0;
        for (uint256 i = 1; i <= boardCount; i++) {
            if (_boards[i].status == BoardStatus.ACTIVE) active++;
        }
        result = new BoardConfig[](active);
        uint256 idx = 0;
        for (uint256 i = 1; i <= boardCount; i++) {
            if (_boards[i].status == BoardStatus.ACTIVE) result[idx++] = _boards[i];
        }
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    function _requireExists(uint256 boardId) internal view {
        if (_boards[boardId].boardCore == address(0)) revert BoardNotFound(boardId);
    }
}
