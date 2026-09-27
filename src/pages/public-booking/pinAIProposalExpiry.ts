export function isPinAIProposalExpired(
  proposal: Readonly<{ expiresAt: string; quote: Readonly<{ quoteExpiresAt: string }> }>,
  now: number,
): boolean {
  const proposalDeadline = Date.parse(proposal.expiresAt);
  const quoteDeadline = Date.parse(proposal.quote.quoteExpiresAt);
  return !Number.isFinite(now) || !Number.isFinite(proposalDeadline) ||
    !Number.isFinite(quoteDeadline) || now >= Math.min(proposalDeadline, quoteDeadline);
}
