(() => {
  const catalog = window.ReportCardTemplateCatalog || (window.ReportCardTemplateCatalog = {});
  catalog.A_LEVEL = [
    { id: "1", label: "Template 1 (Default)", variant: "alevel_default", colors: { header_color: "#4B2E9E", header_text_color: "#FFFFFF", table_header_color: "#E5DDF4", table_header_text_color: "#352369", accent_color: "#8C79B6", background_color: "#F6F2FC" } },
    { id: "2", label: "Template 2 (Blue/Silver)", variant: "alevel_formal", decorative: "#587A9D", codeSubjectPaper: true, projects: true, colors: { header_color: "#193C65", header_text_color: "#FFFFFF", table_header_color: "#D9E2EC", table_header_text_color: "#203247", accent_color: "#587A9D", background_color: "#F3F6F9" } },
    { id: "3", label: "Template 3 (Maroon)", variant: "alevel_traditional", decorative: "#8E3A4C", projects: true, apicultureExample: true, colors: { header_color: "#762B3B", header_text_color: "#FFFFFF", table_header_color: "#F0DDE2", table_header_text_color: "#4B1E29", accent_color: "#8E3A4C", background_color: "#FBF4F5" } },
    { id: "4", label: "Template 4 (Green)", variant: "alevel_eco", decorative: "#668A43", projects: true, projectsHeading: "STUDENT'S PROJECTS WORK", colors: { header_color: "#236344", header_text_color: "#FFFFFF", table_header_color: "#DDEBDD", table_header_text_color: "#254B35", accent_color: "#668A43", background_color: "#F1F7F1" } },
    { id: "5", label: "Template 5 (Gold/Black)", variant: "alevel_honours", decorative: "#B58A2A", studentBanner: true, projects: true, colors: { header_color: "#101820", header_text_color: "#FFFFFF", table_header_color: "#D5B35A", table_header_text_color: "#1B1A15", accent_color: "#B58A2A", background_color: "#FBF7E9" } },
  ];
})();
