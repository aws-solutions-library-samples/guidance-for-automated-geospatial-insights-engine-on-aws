permit (
    principal,
    action in [
        Arcade::Action::"ListGroups",
        Arcade::Action::"DescribeGroup",

        Arcade::Action::"ListRegions",
        Arcade::Action::"DescribeRegion",

        Arcade::Action::"ListPolygons",
        Arcade::Action::"DescribePolygon",

        Arcade::Action::"ListStates",
        Arcade::Action::"DescribeState",

        Arcade::Action::"ListRegionTasks",
        Arcade::Action::"DescribeRegionTask",
        Arcade::Action::"ListRegionTaskItems",
        Arcade::Action::"DescribeRegionTaskItem",

        Arcade::Action::"ListPolygonTasks",
        Arcade::Action::"DescribePolygonTask",
        Arcade::Action::"ListPolygonTaskItems",
        Arcade::Action::"DescribePolygonTaskItem"
    ],
    resource
)
when {
    principal.custom.role == "reader"
};
