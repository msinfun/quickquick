export const calculateNextDate = (dateStr: string, frequency: string, interval: number = 1) => {
  const date = new Date(dateStr.replace(/\//g, '-'));
  
  switch (frequency) {
    case 'daily':
    case 'day':
      date.setDate(date.getDate() + interval);
      break;
    case 'weekly':
    case 'week':
      date.setDate(date.getDate() + (interval * 7));
      break;
    case 'monthly':
    case 'month': {
      const originalDay = date.getDate();
      date.setMonth(date.getMonth() + interval);
      // If the day changed, it means the target month doesn't have enough days
      // (e.g. going from Jan 31 to Feb 28). We should set it to the last day of the intended month.
      if (date.getDate() !== originalDay) {
        date.setDate(0);
      }
      break;
    }
    case 'bi-monthly':
      date.setMonth(date.getMonth() + (interval * 2));
      break;
    case 'quarterly':
      date.setMonth(date.getMonth() + (interval * 3));
      break;
    case 'yearly':
    case 'year':
      date.setFullYear(date.getFullYear() + interval);
      break;
  }
  return date.toISOString().split('T')[0].replace(/-/g, '/');
};

export const getTodayStr = () => {
  return new Date().toISOString().split('T')[0].replace(/-/g, '/');
};
