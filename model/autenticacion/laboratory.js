'use strict';

const LABS = [
    { code: "60200357", passwd: "ATD47B3A", name: "INDAS" },
    { code: "60200614", passwd: "FM48CAT5", name: "PFIZER" },
    { code: "60200118", passwd: "H54CD18A", name: "CINFA" },
    { code: "60201909", passwd: "MG47ACB6", name: "STADA" },
    { code: "60202977", passwd: "D65ANN5T", name: "TEVA" },
    { code: "60201230", passwd: "SE5VT1C7", name: "MEDA-PHARMA" },
    { code: "60203056", passwd: "DH59MBV1", name: "QUALIGEN" },
    { code: "60202713", passwd: "FG4835A7", name: "KERN" },
    { code: "60202056", passwd: "RF471CC8", name: "RATIOPHARM" },
    { code: "60203087", passwd: "FB53MJ1A", name: "ACTAVIS" },
    { code: "60202004", passwd: "HG49LJA3", name: "ITALFARMACO" },
    { code: "60202331", passwd: "MG47ZAH8", name: "RINTER" },
    { code: "60202979", passwd: "3BB2KYW2", name: "RINTER CORONA" },
    { code: "60202707", passwd: "PLF5MW11", name: "IODES" },
    { code: "60200002", passwd: "MF71VBT4", name: "ABBOT PEDIASURE" },
    { code: "60200561", passwd: "MF7AF4P3", name: "NORMON" },
    { code: "60203123", passwd: "GR471A28", name: "" },
    { code: "60203226", passwd: "XT6D26N9", name: "PFIZER_2" },
    { code: "60200767", passwd: "BH49MJ1A", name: "HARTMANN" },
    { code: "60203449", passwd: "FA47CDF8", name: "ABBOT-BGP" },
    { code: "60202422", passwd: "TE47BFA1", name: "MABOFARMA" },
    { code: "60202740", passwd: "BG36AWM7", name: "APOTEX" },
    { code: "60203401", passwd: "GH781AP3", name: "" },
    { code: "60200282", passwd: "3SF58BG1", name: "SANDOZ" },
    { code: "60202659", passwd: "HTB44PA9", name: "BEXAL" },
    { code: "60203016", passwd: "AVP461TR", name: "" },
    { code: "60202637", passwd: "FRT48A15", name: "" },
    { code: "60200223", passwd: "VE68BQ91", name: "ESTEVE" },
    { code: "60202374", passwd: "E47KT1AL", name: "EFFIK" },
    { code: "60202256", passwd: "FR48Q2B6", name: "" },
    { code: "60202257", passwd: "7MJ47ART", name: "" },
    { code: "60202833", passwd: "RY41DAM8", name: "MYLAN" },
    { code: "60200253", passwd: "", name: "FERRER INTERNACIONAL" },
    { code: "60200020", passwd: "", name: "DAIICHI-SANKYO" },
    { code: "60202430", passwd: "", name: "OMEGA-PHARMA" }
];


module.exports.getByLabCode = (labCode) => {

    let labCodeN = labCode.substring(2);

    for (let lab in LABS) {
        if (LABS[lab].code === labCodeN)
            return LABS[lab];
    }
    return null;
}


module.exports.verify = (authRequest) => {
    let lab = module.exports.getByLabCode(authRequest.username);
    return lab && lab.passwd === authRequest.password;
}