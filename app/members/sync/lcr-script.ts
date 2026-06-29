export const LCR_SCRIPT = `function parseDateString(input) {
  const [day, monthStr, year] = input.split(' ');

  const months = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };

  const month = months[monthStr];
  if (!month) throw new Error('Invalid month');

  return \`\${year}-\${month}-\${day.padStart(2, '0')}\`;
}

Array.from(document.querySelectorAll("#individuals tbody tr"))
.map(row => {
  const columns = Array.from(row.querySelectorAll("td"));
  const nameCell = columns[1];
  const name = nameCell.querySelector("button").innerText;
  const nameSplit = name.split(", ");
  const firstName = nameSplit.length > 1 ? nameSplit[1] : nameSplit[0];
  const lastName = nameSplit.length > 1 ? nameSplit[0] : "";
  const isBaptized = !nameCell.innerText.toLowerCase().includes("not baptized");
  const gender = columns[2].innerText.toLowerCase();
  const email = columns[6].innerText ? columns[6].innerText : null;
  const birthDateRaw = columns[4].innerText;
  const birthDate = birthDateRaw ? parseDateString(birthDateRaw) : null;
  return {firstName, lastName, gender, birthDate, email, isBaptized};
});`;
