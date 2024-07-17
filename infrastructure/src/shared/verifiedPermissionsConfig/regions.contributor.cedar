permit (
    principal,
    action in [
        Arcade::Action::"CreateGroup",
        Arcade::Action::"ListGroups",
        Arcade::Action::"DescribeGroup",
        Arcade::Action::"UpdateGroup",

        Arcade::Action::"CreateRegion",
        Arcade::Action::"ListRegions",
        Arcade::Action::"DescribeRegion",
        Arcade::Action::"UpdateRegion",

        Arcade::Action::"CreatePolygon",
        Arcade::Action::"ListPolygons",
        Arcade::Action::"DescribePolygon",
        Arcade::Action::"UpdatePolygon",

        Arcade::Action::"CreateState",
        Arcade::Action::"ListStates",
        Arcade::Action::"DescribeState",
        Arcade::Action::"UpdateState",

        Arcade::Action::"ListRegionTasks",
        Arcade::Action::"DescribeRegionTask",
        Arcade::Action::"CreateRegionTask",
        Arcade::Action::"ListRegionTaskItems",
        Arcade::Action::"DescribeRegionTaskItem",

        Arcade::Action::"ListPolygonTasks",
        Arcade::Action::"DescribePolygonTask",
        Arcade::Action::"CreatePolygonTask",
        Arcade::Action::"ListPolygonTaskItems",
        Arcade::Action::"DescribePolygonTaskItem"
    ],
    resource
)
when {
    principal.custom.role == "contributor"
};
