
export const calculateTenure = (joinDateStr: string): string => {
  const joinDate = new Date(joinDateStr);
  const now = new Date();
  
  let years = now.getFullYear() - joinDate.getFullYear();
  let months = now.getMonth() - joinDate.getMonth();
  
  if (months < 0 || (months === 0 && now.getDate() < joinDate.getDate())) {
    years--;
    months += 12;
  }
  
  const result = [];
  if (years > 0) result.push(`${years} Tahun`);
  if (months > 0) result.push(`${months} Bulan`);
  
  return result.length > 0 ? result.join(' ') : 'Baru Masuk';
};
