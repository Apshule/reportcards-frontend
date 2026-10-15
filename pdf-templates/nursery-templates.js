(() => {
  const catalog = window.ReportCardTemplateCatalog || (window.ReportCardTemplateCatalog = {});
  catalog.NURSERY = [
    { id: "1", label: "Template 1 (Default)", variant: "nursery_default", colors: { header_color: "#3F6B2A", header_text_color: "#FFFFFF", table_header_color: "#DCECCF", table_header_text_color: "#29401F", accent_color: "#8BC34A", background_color: "#F4F9EC" } },
    { id: "2", label: "Template 2 (Orange/Blue)", variant: "nursery_formal", decorative: "#E77B32", signatures: ["Class Teacher", "Behaviors", "Head Teacher"], colors: { header_color: "#173F6D", header_text_color: "#FFFFFF", table_header_color: "#FCE4D4", table_header_text_color: "#4A2A1A", accent_color: "#E77B32", background_color: "#F2F7FD" } },
    { id: "3", label: "Template 3 (Purple/Pink)", variant: "nursery_fees", decorative: "#C86BA7", learnerFeeBar: true, colors: { header_color: "#5A315D", header_text_color: "#FFFFFF", table_header_color: "#F4D9EB", table_header_text_color: "#432A43", accent_color: "#C86BA7", background_color: "#FBF2F8" } },
    { id: "4", label: "Template 4 (Green/Eco)", variant: "nursery_eco", decorative: "#668A43", requirements: true, colors: { header_color: "#285D38", header_text_color: "#FFFFFF", table_header_color: "#DEEAD5", table_header_text_color: "#23482C", accent_color: "#668A43", background_color: "#F2F7ED" } },
    { id: "5", label: "Template 5 (Maroon/Gold)", variant: "nursery_traditional", decorative: "#8E3A4C", photoPlaceholder: true, signatures: ["Class Teacher", "Behaviors", "Head Teacher"], colors: { header_color: "#64263D", header_text_color: "#FFFFFF", table_header_color: "#F1E0B8", table_header_text_color: "#4B2730", accent_color: "#C29A39", background_color: "#FBF5E9" } },
  ];
})();
