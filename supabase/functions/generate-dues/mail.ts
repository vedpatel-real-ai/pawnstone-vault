interface Notice { notice_id: string; recipient: string; message: string }
type Outcome = 'accepted' | 'rejected' | 'unknown'

export async function deliverClaimed(
  notices: Notice[], send: (n: Notice) => Promise<boolean>, record: (id: string, state: Outcome) => Promise<void>
) {
  for (const notice of notices) {
    let state: Outcome
    try {
      state = await send(notice) ? 'accepted' : 'rejected'
    } catch {
      state = 'unknown'
    }
    await record(notice.notice_id,state)
  }
}
