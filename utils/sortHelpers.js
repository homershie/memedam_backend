export const sortByTotalScoreDesc = (array) => {
  if (!Array.isArray(array)) return array
  return array.sort((a, b) => parseFloat(b.total_score || 0) - parseFloat(a.total_score || 0))
}
