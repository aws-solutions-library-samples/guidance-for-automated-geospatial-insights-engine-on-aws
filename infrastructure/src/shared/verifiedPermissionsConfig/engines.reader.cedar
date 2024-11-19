permit (
    principal,
    action in [
        Agie::Action::"ListRegistrations",
        Agie::Action::"DescribeEngine",
        Agie::Action::"ListEngines"
    ],
    resource
)
when {
    principal.custom.role == "reader"
};
