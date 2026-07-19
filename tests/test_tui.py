import asyncio
from datetime import date

from textual.widgets import DataTable, Input, OptionList, TabbedContent

from finance_tracker.services import AccountService, ActivityService, OverviewService
from finance_tracker.tui.app import FinanceTrackerTui
from finance_tracker.tui.home import FinanceTrackerHome
from finance_tracker.tui.views import AccountsView, TransactionsView


def test_inline_home_uses_activity_and_adjustment_actions(tmp_path):
    async def scenario() -> None:
        snapshot = OverviewService(tmp_path / "home.sqlite3").get(7, 2026, as_of=date(2026, 7, 19))
        app = FinanceTrackerHome(snapshot)
        async with app.run_test(size=(80, 24)) as pilot:
            options = app.query_one("#actions", OptionList)
            assert options.highlighted == 0
            assert "Add activity" in str(options.get_option_at_index(0).prompt)
            assert "Update account balance" in str(options.get_option_at_index(3).prompt)
            await pilot.press("down", "enter")
        assert app.return_value == "activity"

    asyncio.run(scenario())


def test_tui_activity_navigation_search_and_account_aware_form(tmp_path):
    async def scenario() -> None:
        db_path = tmp_path / "tui.sqlite3"
        account = AccountService(db_path).create_account(
            "Checking", "asset", "100", "2026-01-01", "cash"
        )
        app = FinanceTrackerTui(db_path=db_path)
        async with app.run_test(size=(120, 40)) as pilot:
            await pilot.press("2")
            await pilot.pause()
            assert app.query_one(TabbedContent).active == "transactions-tab"
            await pilot.press("slash")
            assert app.focused is app.query_one("#transaction-search", Input)
            view = app.query_one(TransactionsView)
            view._add(
                {
                    "kind": "expense",
                    "amount": "42.50",
                    "category": "Food",
                    "account": str(account.id),
                    "description": "Terminal lunch",
                    "date": "2026-07-19",
                }
            )
            await pilot.pause()
            records = ActivityService(db_path).list_activities(kind="expense")
            assert records[0].activity.description == "Terminal lunch"
            assert view.query_one(DataTable).row_count == 2

    asyncio.run(scenario())


def test_tui_account_adjustment_refreshes_calculated_net_worth(tmp_path):
    async def scenario() -> None:
        db_path = tmp_path / "tui.sqlite3"
        account = AccountService(db_path).create_account(
            "Cash", "asset", "100", "2026-07-01", "cash"
        )
        app = FinanceTrackerTui(db_path=db_path)
        async with app.run_test(size=(120, 40)) as pilot:
            await pilot.press("4")
            await pilot.pause()
            view = app.query_one(AccountsView)
            view._adjust(
                account.id,
                {"amount": "150", "date": "2026-07-19", "description": "Observed"},
            )
            await pilot.pause()
            assert (
                AccountService(db_path)
                .get_resolved_account(account.id, "2026-07-19")
                .balance.__str__()
                == "150.00"
            )
            assert "150.00" in str(app.query_one("#net-worth-line").render())

    asyncio.run(scenario())
