permit (
    principal,
    action in [
        Agie::Action::"ListRegistrations",
        Agie::Action::"CreateEngine",
        Agie::Action::"UpdateEngine",
        Agie::Action::"DescribeEngine",
        Agie::Action::"ListEngines",
        Agie::Action::"DeleteEngine"
    ],
    resource
)
when {
    principal.custom.role == "admin"
};
