(() => {
  const catalog = window.ReportCardTemplateCatalog || (window.ReportCardTemplateCatalog = {});
  catalog.O_LEVEL = [
    { id: "1", label: "Template 1 (Default)", variant: "olevel_default", colors: { header_color: "#6A1B82", header_text_color: "#FFFFFF", table_header_color: "#E9D5EF", table_header_text_color: "#452453", accent_color: "#9D6AB0", background_color: "#FBF5FC" } },
    { id: "2", label: "Template 2 (Blue/Silver)", variant: "olevel_formal", decorative: "#587A9D", twoSections: true, colors: { header_color: "#173A63", header_text_color: "#FFFFFF", table_header_color: "#D8E0E8", table_header_text_color: "#1D2A38", accent_color: "#587A9D", background_color: "#F3F6FA" } },
    { id: "3", label: "Template 3 (Green/Eco)", variant: "olevel_eco", decorative: "#668A43", formativeFinal: true, colors: { header_color: "#275D3F", header_text_color: "#FFFFFF", table_header_color: "#DCE9D8", table_header_text_color: "#24472F", accent_color: "#668A43", background_color: "#F2F7ED" } },
    { id: "4", label: "Template 4 (Maroon)", variant: "olevel_traditional", decorative: "#8E3A4C", formativeEotiFinal: true, colors: { header_color: "#742E3E", header_text_color: "#FFFFFF", table_header_color: "#EBD8DD", table_header_text_color: "#49212B", accent_color: "#8E3A4C", background_color: "#FBF5F7" } },
    { id: "5", label: "Template 5 (Blue/Gold)", variant: "olevel_academic", decorative: "#B58A2A", academicBanner: true, alternatePaperCodes: true, colors: { header_color: "#173B68", header_text_color: "#FFFFFF", table_header_color: "#E5D5A6", table_header_text_color: "#30301E", accent_color: "#B58A2A", background_color: "#F8F5E9" } },
  ];
})();
