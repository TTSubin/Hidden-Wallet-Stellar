export const isDifferentWalletAddress = (left: string | null | undefined, right: string | null | undefined): boolean => {
  if (!left || !right) return false;
  return left.toLowerCase() !== right.toLowerCase();
};

export const shouldApplyWalletFetchResult = (args: {
  requestId: number;
  latestRequestId: number;
  requestTargetAddress: string | null | undefined;
  currentTargetAddress: string | null | undefined;
}): boolean => {
  if (args.requestId !== args.latestRequestId) return false;
  if (!args.requestTargetAddress || !args.currentTargetAddress) return false;
  return !isDifferentWalletAddress(args.requestTargetAddress, args.currentTargetAddress);
};
