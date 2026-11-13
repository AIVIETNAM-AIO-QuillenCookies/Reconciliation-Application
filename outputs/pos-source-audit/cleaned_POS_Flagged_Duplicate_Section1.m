section Section1;

shared q_POS_Raw = let
    Source = Csv.Document(File.Contents("C:\Mac\Home\Documents\MacOS\AI Vietnam\Project 02 - eDA 2026\POS_Sales_Export_2025.csv"),[Delimiter=",", Columns=11, Encoding=1252, QuoteStyle=QuoteStyle.None]),
    #"Promoted Headers" = Table.PromoteHeaders(Source, [PromoteAllScalars=true]),
    #"Changed Type" = Table.TransformColumnTypes(#"Promoted Headers",{{"receipt_no", type text}, {"line_no", Int64.Type}, {"business_date", type date}, {"store_id", Int64.Type}, {"product_id", Int64.Type}, {"qty", Int64.Type}, {"unit_price", type number}, {"discount_amount", type number}, {"line_amount", type number}, {"currency", type text}, {"exported_at", type datetime}})
in
    #"Changed Type";

shared q_POS_Flagged = let
    Source = q_POS_Raw,
    #"Added Custom" = Table.AddColumn(Source, "key", each [receipt_no] & "-" & Text.From([line_no])),
    #"Changed Type" = Table.TransformColumnTypes(#"Added Custom",{{"key", type text}})
in
    #"Changed Type";

shared q_POS_Dup_Keys = let
    Source = q_POS_Flagged,
    #"Grouped Rows" = Table.Group(Source, {"key"}, {{"n", each Table.RowCount(_), Int64.Type}}),
    #"Filtered Rows" = Table.SelectRows(#"Grouped Rows", each [n] > 1)
in
    #"Filtered Rows";

shared q_POS_Dup_Rows = let
    Source = q_POS_Flagged,
    #"Merged Queries" = Table.NestedJoin(Source, {"key"}, q_POS_Dup_Keys, {"key"}, "q_POS_Dup_Keys", JoinKind.Inner),
    #"Removed Columns" = Table.RemoveColumns(#"Merged Queries",{"q_POS_Dup_Keys"}),
    #"Sorted Rows" = Table.Sort(#"Removed Columns",{{"key", Order.Ascending}})
in
    #"Sorted Rows";

shared q_POS_First_Export = let
    Source = q_POS_Raw,
    #"Added Custom" = Table.AddColumn(Source, "key", each [receipt_no] & "-" & Text.From([line_no])),
    #"Changed Type" = Table.TransformColumnTypes(#"Added Custom",{{"key", type text}}),
    #"Grouped Rows" = Table.Group(#"Changed Type", {"key"}, {{"first_export", each List.Min([exported_at]), type nullable datetime}}),
    #"Changed Type1" = Table.TransformColumnTypes(#"Grouped Rows",{{"first_export", type datetime}})
in
    #"Changed Type1";