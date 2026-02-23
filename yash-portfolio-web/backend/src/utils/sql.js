function buildWhere() {
  const clauses = [];
  const values = [];
  return {
    add(sqlFragment, value) {
      values.push(value);
      clauses.push(sqlFragment.replace('?', `$${values.length}`));
    },
    addRaw(fragment) {
      clauses.push(fragment);
    },
    done(prefix = 'WHERE') {
      if (!clauses.length) return { text: '', values };
      return { text: `${prefix} ${clauses.join(' AND ')}`, values };
    },
    values,
  };
}

function ilikeTerm(value) {
  return `%${String(value || '').trim()}%`;
}

module.exports = { buildWhere, ilikeTerm };
