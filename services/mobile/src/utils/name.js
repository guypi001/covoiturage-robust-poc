export const getFirstName = (fullName) => {
  if (!fullName) return '';
  const trimmed = String(fullName).trim();
  if (!trimmed) return '';
  return trimmed.split(/\s+/)[0] || '';
};

export const getDisplayName = (account) => {
  if (!account) return 'KariGo User';
  if (account.type === 'COMPANY') {
    return account.companyName || account.email || 'KariGo';
  }
  const firstName = getFirstName(account.fullName);
  return firstName || account.fullName || account.email || 'KariGo';
};
