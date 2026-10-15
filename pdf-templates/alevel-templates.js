(() => {
  const catalog = window.ReportCardTemplateCatalog || (window.ReportCardTemplateCatalog = {});
  catalog.A_LEVEL = [
    { id: "1", label: "Template 1 (Default)", variant: "alevel_default" },
    { id: "2", label: "Template 2 (Blue/Silver)", variant: "alevel_formal", decorative: "#587A9D", codeSubjectPaper: true, projects: true },
    { id: "3", label: "Template 3 (Maroon)", variant: "alevel_traditional", decorative: "#8E3A4C", projects: true, apicultureExample: true },
    { id: "4", label: "Template 4 (Green)", variant: "alevel_eco", decorative: "#668A43", projects: true, projectsHeading: "STUDENT'S PROJECTS WORK" },
    { id: "5", label: "Template 5 (Gold/Black)", variant: "alevel_honours", decorative: "#B58A2A", studentBanner: true, projects: true },
  ];
})();
