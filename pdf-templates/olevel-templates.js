(() => {
  const catalog = window.ReportCardTemplateCatalog || (window.ReportCardTemplateCatalog = {});
  catalog.O_LEVEL = [
    { id: "1", label: "Template 1 (Default)", variant: "olevel_default" },
    { id: "2", label: "Template 2 (Blue/Silver)", variant: "olevel_formal", decorative: "#587A9D", twoSections: true },
    { id: "3", label: "Template 3 (Green/Eco)", variant: "olevel_eco", decorative: "#668A43", formativeFinal: true },
    { id: "4", label: "Template 4 (Maroon)", variant: "olevel_traditional", decorative: "#8E3A4C", formativeEotiFinal: true },
    { id: "5", label: "Template 5 (Blue/Gold)", variant: "olevel_academic", decorative: "#B58A2A", academicBanner: true, alternatePaperCodes: true },
  ];
})();
