permit (
    principal,
    action in [
        Agie::Action::"CreateGroup",
        Agie::Action::"ListGroups",
        Agie::Action::"DescribeGroup",
        Agie::Action::"UpdateGroup",

        Agie::Action::"CreateRegion",
        Agie::Action::"ListRegions",
        Agie::Action::"DescribeRegion",
        Agie::Action::"UpdateRegion",

        Agie::Action::"CreatePolygon",
        Agie::Action::"ListPolygons",
        Agie::Action::"DescribePolygon",
        Agie::Action::"UpdatePolygon",

        Agie::Action::"CreateState",
        Agie::Action::"ListStates",
        Agie::Action::"DescribeState",
        Agie::Action::"UpdateState",

        Agie::Action::"ListRegionTasks",
        Agie::Action::"DescribeRegionTask",
        Agie::Action::"CreateRegionTask",
        Agie::Action::"ListRegionTaskItems",
        Agie::Action::"DescribeRegionTaskItem",

        Agie::Action::"ListPolygonTasks",
        Agie::Action::"DescribePolygonTask",
        Agie::Action::"CreatePolygonTask",
        Agie::Action::"ListPolygonTaskItems",
        Agie::Action::"DescribePolygonTaskItem"
    ],
    resource
)
when {
    principal.custom.role == "contributor"
};
