(() => {
  const catalog = window.ReportCardTemplateCatalog || (window.ReportCardTemplateCatalog = {});
  catalog.NURSERY = [
    { id: "1", label: "Template 1 (Default)", variant: "nursery_default" },
    { id: "2", label: "Template 2 (Orange/Blue)", variant: "nursery_formal", decorative: "#E77B32", signatures: ["Class Teacher", "Behaviors", "Head Teacher"] },
    { id: "3", label: "Template 3 (Purple/Pink)", variant: "nursery_fees", decorative: "#C86BA7", learnerFeeBar: true },
    { id: "4", label: "Template 4 (Green/Eco)", variant: "nursery_eco", decorative: "#668A43", requirements: true },
    { id: "5", label: "Template 5 (Maroon/Gold)", variant: "nursery_traditional", decorative: "#8E3A4C", photoPlaceholder: true, signatures: ["Class Teacher", "Behaviors", "Head Teacher"] },
  ];
})();
