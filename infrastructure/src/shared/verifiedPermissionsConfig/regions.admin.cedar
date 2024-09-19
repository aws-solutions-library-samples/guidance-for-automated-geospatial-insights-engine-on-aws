permit (
    principal,
    action in [
        Agie::Action::"CreateGroup",
        Agie::Action::"ListGroups",
        Agie::Action::"DescribeGroup",
        Agie::Action::"UpdateGroup",
        Agie::Action::"DeleteGroup",

        Agie::Action::"CreateRegion",
        Agie::Action::"ListRegions",
        Agie::Action::"DescribeRegion",
        Agie::Action::"UpdateRegion",
        Agie::Action::"DeleteRegion",

        Agie::Action::"CreatePolygon",
        Agie::Action::"ListPolygons",
        Agie::Action::"DescribePolygon",
        Agie::Action::"UpdatePolygon",
        Agie::Action::"DeletePolygon",

        Agie::Action::"CreateState",
        Agie::Action::"ListStates",
        Agie::Action::"DescribeState",
        Agie::Action::"UpdateState",
        Agie::Action::"DeleteState",

        Agie::Action::"ListRegionTasks",
        Agie::Action::"DescribeRegionTask",
        Agie::Action::"CreateRegionTask",
        Agie::Action::"DeleteRegionTask",
        Agie::Action::"ListRegionTaskItems",
        Agie::Action::"DescribeRegionTaskItem",

        Agie::Action::"ListPolygonTasks",
        Agie::Action::"DescribePolygonTask",
        Agie::Action::"CreatePolygonTask",
        Agie::Action::"DeletePolygonTask",
        Agie::Action::"ListPolygonTaskItems",
        Agie::Action::"DescribePolygonTaskItem"
    ],
    resource
)
when {
    principal.custom.role == "admin"
};
