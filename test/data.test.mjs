import test from "node:test";
import assert from "node:assert/strict";
import { Dataset, delimited, safeCell, exportFilename } from "../dist/data.js";
import { workbook } from "../dist/xlsx.js";
test("merge deduplicates independently of object key order and aligns sparse fields", () => {
  const data = new Dataset();
  assert.equal(data.merge({ fields:[{key:"a",label:"Name"},{key:"b",label:"Value"}],rows:[{a:"One",b:"2"},{b:"2",a:"One"}],truncated:false }), 1);
  assert.equal(data.merge({ fields:[{key:"c",label:"New"}],rows:[{a:"Two",c:"3"}],truncated:false }), 1);
  data.columns[0].name = "Renamed"; data.columns[1].enabled = false;
  assert.deepEqual(data.matrix("two"), [["Renamed","New"],["Two","3"]]);
});
test("row bound terminates collection", () => {
  const data = new Dataset();
  data.merge({ fields:[{key:"a",label:"Name"}], rows:Array.from({length:10002},(_,i)=>({a:String(i)})),truncated:false });
  assert.equal(data.rows.length,10000); assert.equal(data.limited,true);
});
test("export filenames use local calendar dates and safe source page titles", () => {
  const date = new Date(2026, 8, 8, 0, 15);
  assert.equal(exportFilename("EU Startups", "csv", date), "2026.09.08_EU Startups.csv");
  assert.equal(exportFilename("EU Startups", "xlsx", date), "2026.09.08_EU Startups.xlsx");
  assert.equal(exportFilename('Page: A/B?', "csv", date), "2026.09.08_Page_ A_B_.csv");
  assert.equal(exportFilename("   ", "csv", date), "2026.09.08_Untitled page.csv");
});
test("CSV quotes delimiters and newlines and neutralizes spreadsheet formulas", () => {
  for (const s of ["=1+1","+cmd","-2","@SUM(A1)","  =1","\tformula","\ntext"])
    assert.equal(safeCell(s), "'" + s);
  assert.equal(safeCell("ordinary"),"ordinary");
  assert.equal(delimited([['a,b','a"b',"line\nbreak","=2"]]), '"a,b","a""b","line\nbreak","\'=2"');
});
test("XLSX package stores escaped string cells without formula records", () => {
  const bytes = workbook([["Name"],["<tag>&"],["=1+1"],["é☀"]]);
  const view = new DataView(bytes.buffer), decoder = new TextDecoder(); let at = 0;
  const entries = {};
  while(view.getUint32(at,true) === 0x04034b50) {
    const size = view.getUint32(at+18,true), length = view.getUint16(at+26,true);
    const name = decoder.decode(bytes.slice(at+30,at+30+length));
    entries[name] = decoder.decode(bytes.slice(at+30+length,at+30+length+size));
    at += 30+length+size;
  }
  assert.equal(Object.keys(entries).length,5);
  assert.match(entries["xl/worksheets/sheet1.xml"], /&lt;tag&gt;&amp;/);
  assert.match(entries["xl/worksheets/sheet1.xml"], /t="inlineStr"/);
  assert.doesNotMatch(entries["xl/worksheets/sheet1.xml"], /<f[ >]/);
  assert.equal(view.getUint32(at,true),0x02014b50);
});
