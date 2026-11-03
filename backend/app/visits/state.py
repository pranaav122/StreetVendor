"""The only public state transitions; clients never submit arbitrary status."""

ACTIVE = ("PENDING", "ACCEPTED", "APPROACHING", "ARRIVED")
TRACKABLE = ("ACCEPTED", "APPROACHING", "ARRIVED")
TERMINAL = ("DECLINED", "CANCELLED", "EXPIRED", "COMPLETED")
VENDOR_TRANSITIONS = {
    "accept": ({"PENDING"}, "ACCEPTED"),
    "decline": ({"PENDING"}, "DECLINED"),
    "approach": ({"ACCEPTED"}, "APPROACHING"),
    "complete": ({"ARRIVED"}, "COMPLETED"),
}


def allowed_actions(row, *, customer=False, vendor=False):
    actions = []
    if vendor:
        actions.extend(
            name
            for name, (states, _) in VENDOR_TRANSITIONS.items()
            if row.status in states
        )
    if (customer or vendor) and row.status in ACTIVE:
        actions.append("cancel")
    return actions
