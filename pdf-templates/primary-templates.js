(() => {
  const catalog = window.ReportCardTemplateCatalog || (window.ReportCardTemplateCatalog = {});
  catalog.PRIMARY = [
    { id: "1", label: "Template 1 (Default)", variant: "primary_default" },
    { id: "2", label: "Template 2 (Gold/Black)", variant: "primary_formal", decorative: "#B58A2A", aggregation: true, subjectPosition: true },
    { id: "3", label: "Template 3 (Silver/Iridescent)", variant: "primary_silver", decorative: "#7A8792", signatures: ["Class Teacher", "Head of Department", "Principal"], printDate: true, classAverageAge: true },
    { id: "4", label: "Template 4 (Blue/Gold Blank)", variant: "primary_blank", decorative: "#C29A39", blankForm: true },
    { id: "5", label: "Template 5 (Maroon/Gold)", variant: "primary_traditional", decorative: "#8E3A4C", lowerPrimarySignature: true },
  ];
})();
