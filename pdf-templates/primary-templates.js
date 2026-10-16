(() => {
  const catalog = window.ReportCardTemplateCatalog || (window.ReportCardTemplateCatalog = {});
  catalog.PRIMARY = [
    { id: "1", label: "Template 1 (Gold/Black)", variant: "primary_default", decorative: "#B58A2A", colors: { header_color: "#111820", header_text_color: "#FFFFFF", table_header_color: "#D7B45A", table_header_text_color: "#151515", accent_color: "#B58A2A", background_color: "#FBF7E9" } },
    { id: "2", label: "Template 2 (Silver/Iridescent)", variant: "primary_silver", decorative: "#7A8792", signatures: ["Class Teacher", "Head of Department", "Principal"], printDate: true, classAverageAge: true, colors: { header_color: "#BFC4CC", header_text_color: "#25272D", table_header_color: "#E5E7EB", table_header_text_color: "#272632", accent_color: "#8A90A0", background_color: "#F4F2F7" } },
    { id: "3", label: "Template 3 (Blue/Gold)", variant: "primary_formal", decorative: "#B58A2A", aggregation: true, subjectPosition: false, colors: { header_color: "#173B68", header_text_color: "#FFFFFF", table_header_color: "#E5D5A6", table_header_text_color: "#30301E", accent_color: "#B58A2A", background_color: "#F8F5E9" } },
    { id: "4", label: "Template 4 (Maroon/Gold)", variant: "primary_blank", decorative: "#8E3A4C", blankForm: true, lowerPrimarySignature: true, colors: { header_color: "#6B2437", header_text_color: "#FFFFFF", table_header_color: "#D2A648", table_header_text_color: "#4A1D2D", accent_color: "#8E3A4C", background_color: "#FAF1E6" } },
    { id: "5", label: "Template 5 (Maroon/Gold)", variant: "primary_traditional", decorative: "#8E3A4C", lowerPrimarySignature: true, colors: { header_color: "#6B2437", header_text_color: "#FFFFFF", table_header_color: "#D2A648", table_header_text_color: "#4A1D2D", accent_color: "#8E3A4C", background_color: "#FAF1E6" } },
  ];
})();
