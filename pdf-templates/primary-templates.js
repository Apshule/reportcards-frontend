(() => {
  const catalog = window.ReportCardTemplateCatalog || (window.ReportCardTemplateCatalog = {});
  catalog.PRIMARY = [
    { id: "1", label: "Template 1 (Default)", variant: "primary_default", colors: { header_color: "#1E5EB5", header_text_color: "#FFFFFF", table_header_color: "#DCEBFA", table_header_text_color: "#183A68", accent_color: "#5A8CCC", background_color: "#F1F7FD" } },
    { id: "2", label: "Template 2 (Gold/Black)", variant: "primary_formal", decorative: "#B58A2A", aggregation: true, subjectPosition: true, colors: { header_color: "#111820", header_text_color: "#FFFFFF", table_header_color: "#D7B45A", table_header_text_color: "#151515", accent_color: "#B58A2A", background_color: "#FBF7E9" } },
    { id: "3", label: "Template 3 (Silver/Iridescent)", variant: "primary_silver", decorative: "#7A8792", signatures: ["Class Teacher", "Head of Department", "Principal"], printDate: true, classAverageAge: true, colors: { header_color: "#403A4A", header_text_color: "#FFFFFF", table_header_color: "#C9CBD2", table_header_text_color: "#272632", accent_color: "#8A90A0", background_color: "#F4F2F7" } },
    { id: "4", label: "Template 4 (Blue/Gold Blank)", variant: "primary_blank", decorative: "#C29A39", blankForm: true, colors: { header_color: "#18395B", header_text_color: "#FFFFFF", table_header_color: "#D4B45A", table_header_text_color: "#172C48", accent_color: "#C29A39", background_color: "#F3F7FC" } },
    { id: "5", label: "Template 5 (Maroon/Gold)", variant: "primary_traditional", decorative: "#8E3A4C", lowerPrimarySignature: true, colors: { header_color: "#6B2437", header_text_color: "#FFFFFF", table_header_color: "#D2A648", table_header_text_color: "#4A1D2D", accent_color: "#8E3A4C", background_color: "#FAF1E6" } },
  ];
})();
