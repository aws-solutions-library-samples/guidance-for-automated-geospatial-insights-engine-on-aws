permit (
    principal,
    action in [
        Agie::Action::"ListResults",
        Agie::Action::"DescribeResult"
    ],
    resource
)
when {
    principal.custom.role == "reader"
};
