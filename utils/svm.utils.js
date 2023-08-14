const { sequelize } = require("../models/index");
const { QueryTypes } = require("sequelize");
const PDFDocument = require("pdfkit-table");
const ChartJsImage = require("chartjs-to-image");
const fs = require("fs");
const ExcelJS = require("exceljs");

async function createReports(id, results) {
  const candidates = await sequelize.query(
    "SELECT id, name from e_vote_candidate WHERE election_id = :id",
    {
      type: QueryTypes.SELECT,
      replacements: { id: id },
    }
  );
  const voters = await sequelize.query(
    "select evu.id, evu.email, evu.display_name, evv.voted from e_vote_voter evv inner join e_vote_user evu on evu.id = evv.user_id where evv.election_id = :id",
    {
      type: QueryTypes.SELECT,
      replacements: { id: id },
    }
  );
  const candidateVotes = [];
  for (const candidate of candidates) {
    candidate["votes"] = results[candidate.id];
    candidateVotes.push([candidate.name, results[candidate.id]]);
  }
  candidateVotes.push(["blank", results["blank"] ? results["blank"] : 0]);
  const voted = voters.filter((x) => x.voted !== null).length;
  const notVoted = voters.length - voted;
  /*-----------------------------PDF--------------------------------*/
  const chartCandidates = [];
  const chartVotes = [];
  const tableVoters = [];
  for (const c of candidateVotes) {
    chartCandidates.push(c[0]);
    chartVotes.push(c[1]);
  }
  for (const v of voters) {
    tableVoters.push([v.display_name, v.email, v.voted ? "yes" : "no"]);
  }
  let doc = new PDFDocument({ margin: 30, size: "A4" });
  const voteChart = new ChartJsImage();
  voteChart.setConfig({
    type: "pie",
    data: {
      labels: chartCandidates,
      datasets: [
        {
          data: chartVotes,
        },
      ],
    },
  });
  await voteChart.toFile(`./files/reports/${id}_voteChart.png`);
  const abstentionChart = new ChartJsImage();
  abstentionChart.setConfig({
    type: "pie",
    data: {
      labels: ["Voted", "Not Voted"],
      datasets: [
        {
          data: [voted, notVoted],
        },
      ],
    },
  });
  await abstentionChart.toFile(`./files/reports/${id}_abstentionChart.png`);
  doc.pipe(fs.createWriteStream(`./files/reports/pdf/report_${id}.pdf`));
  doc.image(`./files/reports/${id}_abstentionChart.png`, 0, 0, {
    width: 300,
  });
  doc.image(`./files/reports/${id}_voteChart.png`, 320, 0, {
    width: 300,
  });
  doc.moveDown(12);
  const tableArray = {
    title: "Results",
    headers: [
      { label: "Candidate", align: "center" },
      { label: "Votes", align: "center" },
    ],
    rows: candidateVotes,
  };
  doc.moveDown();
  doc.table(tableArray, 0, 1000); // A4 595.28 x 841.89 (portrait) (about width sizes)
  doc.moveDown(); // separate tables
  const table = {
    title: "Voters",
    headers: [
      { label: "Display Name", align: "left" },
      { label: "Email", align: "center" },
      { label: "Voted", align: "right" },
    ],
    rows: tableVoters,
  };
  doc.table(table, 0, 1000);
  doc.end();
  fs.unlinkSync(`./files/reports/${id}_abstentionChart.png`);
  fs.unlinkSync(`./files/reports/${id}_voteChart.png`);
  /*-----------------------------XLSX--------------------------------*/
  const xlsxCandidateVotes = [];
  const electionVoters = [];
  for (const candidate of candidates) {
    candidate["votes"] = results[candidate.id];
    xlsxCandidateVotes.push({
      candidate: candidate.name,
      votes: results[candidate.id],
    });
  }
  xlsxCandidateVotes.push({
    candidate: "blank",
    votes: results["blank"] ? results["blank"] : 0,
  });
  for (const v of voters) {
    electionVoters.push({
      displayName: v.display_name,
      email: v.email,
      voted: v.voted ? "yes" : "no",
    });
  }
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Secure Vote";
  workbook.lastModifiedBy = "Secure Vote";
  workbook.views = [
    {
      x: 0,
      y: 0,
      width: 10000,
      height: 20000,
      firstSheet: 0,
      activeTab: 1,
      visibility: "visible",
    },
  ];
  const resultsSheet = workbook.addWorksheet("Results");
  resultsSheet.columns = [
    { header: "Candidate", key: "candidate" },
    { header: "Votes", key: "votes" },
  ];
  resultsSheet.addRows(xlsxCandidateVotes);
  const voterSheet = workbook.addWorksheet("Voters");
  voterSheet.columns = [
    { header: "Display Name", key: "displayName" },
    { header: "Email", key: "email" },
    { header: "Voted", key: "voted" },
  ];
  voterSheet.addRows(electionVoters);
  await workbook.xlsx.writeFile(`files/reports/xlsx/report_${id}.xlsx`);
  await sequelize.query("CALL insert_election_reports (:id, :pdf, :xlsx);", {
    replacements: {
      id: id,
      pdf: `report_${id}.pdf`,
      xlsx: `report_${id}.xlsx`,
    },
  });
}

module.exports = { createReports };
