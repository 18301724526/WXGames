const XLSX = require('xlsx');

function buildTemplateWorkbookBuffer(definitions) {
  const rows = (definitions.tasks || []).map((task) => ({
    id: task.id,
    category: task.category,
    title: task.title,
    description: task.description,
    'condition.type': task.condition?.type || 'always',
    'condition.target': task.condition?.buildingId || task.condition?.eventId || task.condition?.era || '',
    'condition.grantType': task.condition?.grantType || '',
    'condition.grantKey': task.condition?.grantKey || '',
    'condition.count': task.condition?.count || '',
    'reward.formulas': (task.reward?.formulas || []).join(';'),
    'reward.formulaResourcesResolved': task.reward?.formulaResourcesResolved ? 1 : '',
    'reward.food': task.reward?.resources?.food || '',
    'reward.wood': task.reward?.resources?.wood || '',
    'reward.knowledge': task.reward?.resources?.knowledge || '',
    sortOrder: task.sortOrder,
    enabled: task.enabled ? 1 : 0,
  }));
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, 'tasks');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

module.exports = {
  buildTemplateWorkbookBuffer,
};
