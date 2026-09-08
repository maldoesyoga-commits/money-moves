import { supabase } from './supabase'

// The account balance deltas a transaction causes, times `sign` (+1 to apply,
// -1 to reverse). Money sourced from a debt (from_debt_id, no from_account_id)
// touches no account here — the debt draw is handled separately.
export function effectDeltas(txn, sign) {
  const amount = (Number(txn.amount) || 0) * sign
  const deltas = []

  if (txn.direction === 'out') {
    if (txn.from_account_id) deltas.push({ accountId: txn.from_account_id, delta: -amount })
  } else if (txn.direction === 'in') {
    if (txn.to_account_id) deltas.push({ accountId: txn.to_account_id, delta: amount })
  } else if (txn.direction === 'transfer') {
    if (txn.from_account_id) deltas.push({ accountId: txn.from_account_id, delta: -amount })
    if (txn.to_account_id) deltas.push({ accountId: txn.to_account_id, delta: amount })
  }

  return deltas
}

export function mergeDeltaLists(...lists) {
  const map = new Map()
  for (const list of lists) {
    for (const { accountId, delta } of list) {
      if (!accountId) continue
      map.set(accountId, (map.get(accountId) || 0) + delta)
    }
  }
  return map
}

export async function applyBalanceDeltas(deltaMap) {
  for (const [accountId, delta] of deltaMap.entries()) {
    if (!delta) continue

    const { data: account, error: fetchError } = await supabase
      .from('accounts')
      .select('balance')
      .eq('id', accountId)
      .single()

    if (fetchError) {
      console.log(fetchError.message)
      return false
    }

    const { error: updateError } = await supabase
      .from('accounts')
      .update({ balance: Number(account.balance || 0) + delta })
      .eq('id', accountId)

    if (updateError) {
      console.log(updateError.message)
      return false
    }
  }

  return true
}
