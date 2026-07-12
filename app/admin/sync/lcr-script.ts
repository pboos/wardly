
// Reads the data from the HTML document on:
// https://lcr.churchofjesuschrist.org/mlt/records/member-list?lang=eng
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

// Uses API to get member data
// - Seems not to work consistently. Works when I tried it first, but then after a few days it didn't work anymore.
// export const LCR_SCRIPT = `const response = await fetch("https://lcr.churchofjesuschrist.org/mlt/records/member-list?lang=eng", {
//   "headers": {
//     "accept": "text/x-component",
//     "accept-language": "en-US,en;q=0.5",
//     "content-type": "text/plain;charset=UTF-8",
//     "next-action": "60dfac8069fd11678e8615f75a36d922cb224c55f6",
//     "next-router-state-tree": "%5B%22%22%2C%7B%22children%22%3A%5B%22records%22%2C%7B%22children%22%3A%5B%22member-list%22%2C%7B%22children%22%3A%5B%22__PAGE__%22%2C%7B%7D%2Cnull%2Cnull%2C0%5D%7D%2Cnull%2Cnull%2C0%5D%7D%2Cnull%2Cnull%2C0%5D%7D%2Cnull%2Cnull%2C20%5D",
//     "sec-ch-ua": "\\"Not;A=Brand\\";v=\\"8\\", \\"Chromium\\";v=\\"150\\", \\"Brave\\";v=\\"150\\"",
//     "sec-ch-ua-mobile": "?0",
//     "sec-ch-ua-platform": "\\"Windows\\"",
//     "sec-fetch-dest": "empty",
//     "sec-fetch-mode": "cors",
//     "sec-fetch-site": "same-origin",
//     "sec-gpc": "1"
//   },
//   "referrer": "https://lcr.churchofjesuschrist.org/",
//   "body": "[\\"$undefined\\",\\"eng\\"]",
//   "method": "POST",
//   "mode": "cors",
//   "credentials": "include"
// }).then(res => res.text());
// const lines = response.split('\\n');
// const membersLine =  lines.find(line => line.startsWith('1:'));
// const membersLcr = JSON.parse(membersLine.substr(2));

// const members = membersLcr.members.map(memberLcr => {
//   const nameParts = memberLcr.nameFormats.listPreferredLocal.split(",").map(n => n.trim());
//   const firstName = nameParts.length > 1 ? nameParts[1] : nameParts[0];
//   const lastName = nameParts.length > 1 ? nameParts[0] : "";
//   return {
//     "externalUuid": memberLcr.uuid,
//     "externalHouseholdUuid": memberLcr.householdUuid,
//     "externalHouseholdRole": memberLcr.householdRole,
//     "firstName": firstName,
//     "lastName": lastName,
//     "gender": memberLcr.sex === "MALE" ? "m" : "f",
//     "birthDate": memberLcr.birthDateSort,
//     "email": memberLcr.email,
//     "isBaptized": memberLcr.statusFlags.baptizedAndConfirmed,
//   };
// });`;
