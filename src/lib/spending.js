// "Real spending" excludes transfers (direction is 'transfer', never 'out')
// and out-transactions linked to a debt payment (debt_id set) - those move
// money between your own accounts or pay down debt, they don't reflect
// discretionary spending. Shared by Insights and the Home budgets section
// so both agree on what counts.
export function isSpendingTxn(txn) {
  return txn.direction === 'out' && !txn.debt_id
}
